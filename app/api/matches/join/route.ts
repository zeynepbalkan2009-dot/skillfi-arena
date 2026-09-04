import { NextRequest, NextResponse } from "next/server";
import { getAddress, parseEventLogs } from "viem";
import { getCurrentProfile } from "@/lib/auth/server";
import { escrowPublicClient, getEscrowWalletClient, ESCROW_CONTRACT_ADDRESS, skillFiEscrowAbi } from "@/lib/serverEscrow";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordAuditEvent } from "@/lib/audit";
import { confirmStakeReservation } from "@/lib/risk";
import { BETA_ACCESS_ERROR, hasActiveBetaAccess } from "@/lib/betaPilot";
import { isPilotGameId } from "@/lib/pilotGames";

export const dynamic = "force-dynamic";
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE });

  const body = await request.json().catch(() => null) as { matchId?: string; txHash?: `0x${string}` } | null;
  if (!body?.matchId || !body.txHash) return NextResponse.json({ error: "matchId and txHash are required" }, { status: 400, headers: PRIVATE_NO_STORE });
  let matchId: bigint;
  try { matchId = BigInt(body.matchId); } catch { return NextResponse.json({ error: "Invalid matchId" }, { status: 400, headers: PRIVATE_NO_STORE }); }

  if (!user.wallet_address) return NextResponse.json({ error: "Wallet is not linked" }, { status: 400, headers: PRIVATE_NO_STORE });
  const caller = getAddress(user.wallet_address);

  const receipt = await escrowPublicClient.getTransactionReceipt({ hash: body.txHash });
  if (receipt.status !== "success") return NextResponse.json({ error: "Join transaction reverted" }, { status: 400, headers: PRIVATE_NO_STORE });
  if (!receipt.to || getAddress(receipt.to) !== getAddress(ESCROW_CONTRACT_ADDRESS)) {
    return NextResponse.json({ error: "Transaction does not target the SkillFi escrow" }, { status: 400, headers: PRIVATE_NO_STORE });
  }
  if (getAddress(receipt.from) !== caller) {
    return NextResponse.json({ error: "Join transaction sender does not match authenticated wallet" }, { status: 403, headers: PRIVATE_NO_STORE });
  }

  const joinLogs = parseEventLogs({ abi: skillFiEscrowAbi, logs: receipt.logs, eventName: "PlayerJoined" });
  const exactJoin = joinLogs.some((log) =>
    getAddress(log.address) === getAddress(ESCROW_CONTRACT_ADDRESS)
    && log.args.matchId === matchId
    && getAddress(log.args.player) === caller
  );
  if (!exactJoin) {
    return NextResponse.json({ error: "Join event does not match this player and match" }, { status: 400, headers: PRIVATE_NO_STORE });
  }

  const onchain = await escrowPublicClient.readContract({ address: ESCROW_CONTRACT_ADDRESS, abi: skillFiEscrowAbi, functionName: "matches", args: [matchId] });
  const player1 = getAddress(onchain[0]);
  const player2 = getAddress(onchain[1]);
  if (caller !== player1 && caller !== player2) return NextResponse.json({ error: "Wallet is not a participant in this match" }, { status: 403, headers: PRIVATE_NO_STORE });

  const { data: dbMatch, error: dbError } = await supabaseAdmin.from("matches").select("id, player_a_id, player_b_id, status, game:games(slug)").eq("smart_contract_match_id", matchId.toString()).maybeSingle();
  if (dbError) {
    console.error("Join match lookup failed:", dbError.message);
    return NextResponse.json({ error: "Could not load match" }, { status: 500, headers: PRIVATE_NO_STORE });
  }
  if (!dbMatch) return NextResponse.json({ error: "Match not indexed" }, { status: 404, headers: PRIVATE_NO_STORE });
  const game = dbMatch.game as unknown as { slug?: string } | null;
  if (isPilotGameId(game?.slug) && !(await hasActiveBetaAccess(user.id))) {
    return NextResponse.json({ error: BETA_ACCESS_ERROR }, { status: 403, headers: PRIVATE_NO_STORE });
  }

  await recordAuditEvent({
    matchId: dbMatch.id,
    actorUserId: user.id,
    eventType: "deposit_confirmed",
    txHash: body.txHash,
    idempotencyKey: `deposit_confirmed:${body.txHash.toLowerCase()}`,
    payload: { smartContractMatchId: matchId.toString(), onchainStatus: Number(onchain[6]) },
  });
  await confirmStakeReservation(user.id, dbMatch.id);

  const updates: Record<string, string> = {};
  if (caller === player1 && Number(onchain[6]) === 1) updates.status = "searching";
  if (caller === player2 && !dbMatch.player_b_id) updates.player_b_id = user.id;

  if (Number(onchain[6]) === 2) {
    const escrowWalletClient = getEscrowWalletClient();
    let startHash: `0x${string}` | null = null;
    try {
      startHash = await escrowWalletClient.writeContract({ address: ESCROW_CONTRACT_ADDRESS, abi: skillFiEscrowAbi, functionName: "startMatch", args: [matchId] });
      const startReceipt = await escrowPublicClient.waitForTransactionReceipt({ hash: startHash });
      if (startReceipt.status !== "success") throw new Error("start transaction reverted");
    } catch (error) {
      const latest = await escrowPublicClient.readContract({ address: ESCROW_CONTRACT_ADDRESS, abi: skillFiEscrowAbi, functionName: "matches", args: [matchId] });
      if (Number(latest[6]) !== 3) {
        console.error("Match start failed:", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Both players joined, but the match could not be started" }, { status: 502, headers: PRIVATE_NO_STORE });
      }
    }
    updates.status = "active";
    updates.started_at = new Date().toISOString();
    await recordAuditEvent({
      matchId: dbMatch.id,
      actorUserId: user.id,
      eventType: "match_started",
      txHash: startHash,
      idempotencyKey: `match_started:${matchId.toString()}`,
      payload: { smartContractMatchId: matchId.toString(), concurrentRecovery: !startHash },
    });
  }

  if (Object.keys(updates).length) {
    const { error: updateError } = await supabaseAdmin.from("matches").update(updates).eq("id", dbMatch.id);
    if (updateError) {
      console.error("Join match index update failed:", updateError.message);
      return NextResponse.json({ error: "Could not update match state" }, { status: 500, headers: PRIVATE_NO_STORE });
    }
  }
  return NextResponse.json({ ok: true, matchId: matchId.toString(), status: updates.status ?? dbMatch.status }, { headers: PRIVATE_NO_STORE });
}
