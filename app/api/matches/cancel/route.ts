import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { recordAuditEvent } from "@/lib/audit";
import { getCurrentProfile } from "@/lib/auth/server";
import { releaseMatchStakeReservations } from "@/lib/risk";
import { ESCROW_CONTRACT_ADDRESS, escrowPublicClient, getEscrowWalletClient, skillFiEscrowAbi } from "@/lib/serverEscrow";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { matchId?: string } | null;
  if (!body?.matchId) return NextResponse.json({ error: "matchId is required" }, { status: 400 });

  const { data: match, error: matchError } = await supabaseAdmin
    .from("matches")
    .select("id,smart_contract_match_id,player_a_id,player_b_id,status")
    .eq("id", body.matchId)
    .maybeSingle();
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.player_a_id !== user.id) return NextResponse.json({ error: "Only the match creator can cancel" }, { status: 403 });
  if (!["waiting_on_chain", "searching", "cancelled"].includes(match.status)) {
    return NextResponse.json({ error: "A started or settling match cannot be cancelled" }, { status: 409 });
  }

  const chainMatchId = BigInt(match.smart_contract_match_id);
  let onchain = await escrowPublicClient.readContract({
    address: ESCROW_CONTRACT_ADDRESS,
    abi: skillFiEscrowAbi,
    functionName: "matches",
    args: [chainMatchId],
  });
  let cancellationHash: `0x${string}` | null = null;
  if (Number(onchain[6]) === 1) {
    const walletClient = getEscrowWalletClient();
    cancellationHash = await walletClient.writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: skillFiEscrowAbi,
      functionName: "cancelMatch",
      args: [chainMatchId],
    });
    const receipt = await escrowPublicClient.waitForTransactionReceipt({ hash: cancellationHash });
    if (receipt.status !== "success") return NextResponse.json({ error: "Cancellation transaction reverted" }, { status: 502 });
    onchain = await escrowPublicClient.readContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: skillFiEscrowAbi,
      functionName: "matches",
      args: [chainMatchId],
    });
  } else if (Number(onchain[6]) !== 6) {
    return NextResponse.json({ error: `Unexpected on-chain match state ${Number(onchain[6])}` }, { status: 409 });
  }

  if (!cancellationHash) {
    const { data: previous } = await supabaseAdmin
      .from("match_audit_events")
      .select("tx_hash")
      .eq("match_id", match.id)
      .eq("event_type", "match_cancelled")
      .not("tx_hash", "is", null)
      .limit(1)
      .maybeSingle();
    cancellationHash = (previous?.tx_hash as `0x${string}` | undefined) ?? null;
  }

  const chainWallets = [onchain[0], onchain[1]].filter(
    (address) => address !== "0x0000000000000000000000000000000000000000",
  );
  const participantIds = [match.player_a_id, match.player_b_id].filter((id): id is string => Boolean(id));
  const { data: participants, error: participantError } = await supabaseAdmin
    .from("users")
    .select("id,wallet_address")
    .in("id", participantIds);
  if (participantError) return NextResponse.json({ error: participantError.message }, { status: 500 });
  const usersByWallet = new Map<string, string>(
    ((participants ?? []) as Array<{ id: string; wallet_address: string | null }>)
      .filter((participant) => participant.wallet_address)
      .map((participant) => [getAddress(participant.wallet_address!).toLowerCase(), participant.id]),
  );

  if (cancellationHash) {
    for (const wallet of chainWallets) {
      const participantId = usersByWallet.get(getAddress(wallet).toLowerCase());
      if (!participantId) return NextResponse.json({ error: "Refund recipient does not match a database participant" }, { status: 409 });
      const { error: refundError } = await supabaseAdmin.from("transactions").upsert(
        {
          user_id: participantId,
          match_id: match.id,
          tx_hash: cancellationHash.toLowerCase(),
          kind: "refund",
          amount: onchain[2].toString(),
          status: "confirmed",
        },
        { onConflict: "tx_hash,kind,user_id" },
      );
      if (refundError) return NextResponse.json({ error: `Refund recording failed: ${refundError.message}` }, { status: 500 });
    }
  }

  const { error: updateError } = await supabaseAdmin.from("matches").update({ status: "cancelled" }).eq("id", match.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await releaseMatchStakeReservations(match.id);
  await recordAuditEvent({
    matchId: match.id,
    actorUserId: user.id,
    eventType: "match_cancelled",
    txHash: cancellationHash,
    idempotencyKey: `match_cancelled:${match.id}`,
    payload: { refundedUsers: chainWallets.length, amountEach: onchain[2].toString() },
  });
  return NextResponse.json({ status: "cancelled", txHash: cancellationHash, refundedUsers: chainWallets.length });
}
