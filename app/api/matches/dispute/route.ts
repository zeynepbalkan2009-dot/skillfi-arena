import { NextRequest, NextResponse } from "next/server";
import { getAddress, parseEventLogs } from "viem";
import { recordAuditEvent } from "@/lib/audit";
import { getCurrentProfile } from "@/lib/auth/server";
import { ESCROW_CONTRACT_ADDRESS, escrowPublicClient, skillFiEscrowAbi } from "@/lib/serverEscrow";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE });
  const body = (await request.json().catch(() => null)) as { matchId?: string; txHash?: `0x${string}`; reason?: string } | null;
  if (!body?.matchId || !body.txHash) return NextResponse.json({ error: "matchId and txHash are required" }, { status: 400, headers: PRIVATE_NO_STORE });
  const reason = body.reason?.trim().replace(/\s+/g, " ") ?? "";
  if (reason.length < 10 || reason.length > 500) {
    return NextResponse.json({ error: "Dispute reason must be between 10 and 500 characters" }, { status: 400, headers: PRIVATE_NO_STORE });
  }
  if (!user.wallet_address) return NextResponse.json({ error: "Wallet is not linked" }, { status: 400, headers: PRIVATE_NO_STORE });

  const { data: match, error: matchError } = await supabaseAdmin
    .from("matches")
    .select("id,smart_contract_match_id,player_a_id,player_b_id,status")
    .eq("id", body.matchId)
    .maybeSingle();
  if (matchError) {
    console.error("Dispute match lookup failed:", matchError.message);
    return NextResponse.json({ error: "Could not load match" }, { status: 500, headers: PRIVATE_NO_STORE });
  }
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404, headers: PRIVATE_NO_STORE });
  if (match.player_a_id !== user.id && match.player_b_id !== user.id) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403, headers: PRIVATE_NO_STORE });
  }
  if (match.status !== "active" && match.status !== "disputed") {
    return NextResponse.json({ error: "Only an active match can be disputed" }, { status: 409, headers: PRIVATE_NO_STORE });
  }

  const receipt = await escrowPublicClient.getTransactionReceipt({ hash: body.txHash });
  if (receipt.status !== "success") return NextResponse.json({ error: "Dispute transaction reverted" }, { status: 400, headers: PRIVATE_NO_STORE });
  if (!receipt.to || getAddress(receipt.to) !== getAddress(ESCROW_CONTRACT_ADDRESS)) {
    return NextResponse.json({ error: "Transaction does not target the SkillFi escrow" }, { status: 400, headers: PRIVATE_NO_STORE });
  }
  if (getAddress(receipt.from) !== getAddress(user.wallet_address)) {
    return NextResponse.json({ error: "Transaction sender does not match the authenticated wallet" }, { status: 403, headers: PRIVATE_NO_STORE });
  }
  const logs = parseEventLogs({ abi: skillFiEscrowAbi, logs: receipt.logs, eventName: "MatchDisputed" });
  const expectedChainId = BigInt(match.smart_contract_match_id);
  if (!logs.some((log) => getAddress(log.address) === getAddress(ESCROW_CONTRACT_ADDRESS) && log.args.matchId === expectedChainId)) {
    return NextResponse.json({ error: "Dispute event does not match this match" }, { status: 400, headers: PRIVATE_NO_STORE });
  }
  const onchain = await escrowPublicClient.readContract({
    address: ESCROW_CONTRACT_ADDRESS,
    abi: skillFiEscrowAbi,
    functionName: "matches",
    args: [expectedChainId],
  });
  if (Number(onchain[6]) !== 5) return NextResponse.json({ error: "On-chain match is not disputed" }, { status: 409, headers: PRIVATE_NO_STORE });

  const { error: updateError } = await supabaseAdmin
    .from("matches")
    .update({ status: "disputed" })
    .eq("id", match.id)
    .in("status", ["active", "disputed"]);
  if (updateError) {
    console.error("Dispute match update failed:", updateError.message);
    return NextResponse.json({ error: "Could not update dispute state" }, { status: 500, headers: PRIVATE_NO_STORE });
  }
  await recordAuditEvent({
    matchId: match.id,
    actorUserId: user.id,
    eventType: "match_disputed",
    txHash: body.txHash,
    idempotencyKey: `match_disputed:${match.id}`,
    payload: { smartContractMatchId: match.smart_contract_match_id, reason },
  });
  return NextResponse.json({ status: "disputed", txHash: body.txHash }, { headers: PRIVATE_NO_STORE });
}
