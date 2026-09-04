import "server-only";

import { recordAuditEvent } from "@/lib/audit";
import {
  ESCROW_CONTRACT_ADDRESS,
  escrowPublicClient,
  getEscrowWalletClient,
  skillFiEscrowAbi,
} from "@/lib/serverEscrow";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SettlementMatch = {
  id: string;
  smart_contract_match_id: string;
  player_a_id: string;
  player_b_id: string;
  winner_id: string | null;
  status: string;
};

type Address = `0x${string}`;

export class MatchDisputedError extends Error {
  constructor() {
    super("Match is disputed on-chain; automatic settlement is paused");
    this.name = "MatchDisputedError";
  }
}

export async function settleAndReconcileMatch(match: SettlementMatch, actorUserId: string | null) {
  const winnerId = match.winner_id;
  if (!winnerId || (winnerId !== match.player_a_id && winnerId !== match.player_b_id)) {
    throw new Error("Settlement winner must be a match participant");
  }

  const { data: players, error: playersError } = await supabaseAdmin
    .from("users")
    .select("id,wallet_address")
    .in("id", [match.player_a_id, match.player_b_id]);
  if (playersError) throw new Error(`Player lookup failed: ${playersError.message}`);
  const playerRows = (players ?? []) as Array<{ id: string; wallet_address: string | null }>;
  const wallets = new Map<string, string | undefined>(
    playerRows.map((player) => [player.id, player.wallet_address?.toLowerCase()]),
  );
  const playerAWallet = wallets.get(match.player_a_id);
  const playerBWallet = wallets.get(match.player_b_id);
  const winnerWallet = wallets.get(winnerId);
  if (!playerAWallet || !playerBWallet || !winnerWallet) throw new Error("Both participants need verified wallets");

  const chainMatchId = BigInt(match.smart_contract_match_id);
  let onchain = await escrowPublicClient.readContract({
    address: ESCROW_CONTRACT_ADDRESS,
    abi: skillFiEscrowAbi,
    functionName: "matches",
    args: [chainMatchId],
  });
  if (Number(onchain[6]) === 5) throw new MatchDisputedError();
  const chainPlayers = [onchain[0].toLowerCase(), onchain[1].toLowerCase()];
  if (!chainPlayers.includes(playerAWallet) || !chainPlayers.includes(playerBWallet)) {
    throw new Error("On-chain participants do not match the database");
  }
  if (!chainPlayers.includes(winnerWallet)) throw new Error("Winner wallet is not an on-chain participant");

  const feeBps = await escrowPublicClient.readContract({
    address: ESCROW_CONTRACT_ADDRESS,
    abi: skillFiEscrowAbi,
    functionName: "platformFeeBps",
  });
  const totalPrize = onchain[2] * 2n;
  const payout = totalPrize - (totalPrize * feeBps) / 10_000n;

  let settlementHash: `0x${string}` | null = null;
  if (Number(onchain[6]) === 3) {
    try {
      const walletClient = getEscrowWalletClient();
      settlementHash = await walletClient.writeContract({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: skillFiEscrowAbi,
        functionName: "resolveMatch",
        args: [chainMatchId, winnerWallet as Address],
      });
      const { error: pendingTransactionError } = await supabaseAdmin.from("transactions").upsert(
        {
          user_id: winnerId,
          match_id: match.id,
          tx_hash: settlementHash.toLowerCase(),
          kind: "settlement",
          amount: payout.toString(),
          status: "pending",
        },
        { onConflict: "tx_hash,kind,user_id" },
      );
      if (pendingTransactionError) throw new Error(`Pending settlement recording failed: ${pendingTransactionError.message}`);
      await recordAuditEvent({
        matchId: match.id,
        actorUserId,
        eventType: "settlement_broadcast",
        txHash: settlementHash,
        idempotencyKey: `settlement_broadcast:${match.id}`,
        payload: { winnerId, winnerWallet, payout: payout.toString() },
      });
      const receipt = await escrowPublicClient.waitForTransactionReceipt({ hash: settlementHash });
      if (receipt.status !== "success") throw new Error("Settlement transaction reverted");
      onchain = await escrowPublicClient.readContract({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: skillFiEscrowAbi,
        functionName: "matches",
        args: [chainMatchId],
      });
    } catch (error) {
      // A concurrent retry may have settled the contract first. Re-read the
      // authoritative chain state before deciding that the operation failed.
      onchain = await escrowPublicClient.readContract({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: skillFiEscrowAbi,
        functionName: "matches",
        args: [chainMatchId],
      });
      if (Number(onchain[6]) !== 4) throw error;
    }
  } else if (Number(onchain[6]) !== 4) {
    throw new Error(`Unexpected on-chain match state ${Number(onchain[6])}`);
  }

  if (Number(onchain[6]) !== 4) {
    throw new Error("Settlement did not reach the resolved on-chain state");
  }
  const canonicalWinner = onchain[8]?.toLowerCase();
  if (!canonicalWinner || canonicalWinner === "0x0000000000000000000000000000000000000000") {
    throw new Error("Resolved escrow does not expose a canonical winner; SkillFiEscrowV3 is required");
  }
  if (canonicalWinner !== winnerWallet) {
    throw new Error("On-chain winner does not match the database winner; reconciliation aborted");
  }

  if (!settlementHash) {
    const { data: previousEvent } = await supabaseAdmin
      .from("match_audit_events")
      .select("tx_hash")
      .eq("match_id", match.id)
      .eq("event_type", "settlement_confirmed")
      .not("tx_hash", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    settlementHash = (previousEvent?.tx_hash as `0x${string}` | undefined) ?? null;
  }

  if (settlementHash) {
    const { error: transactionError } = await supabaseAdmin.from("transactions").upsert(
      {
        user_id: winnerId,
        match_id: match.id,
        tx_hash: settlementHash.toLowerCase(),
        kind: "settlement",
        amount: payout.toString(),
        status: "confirmed",
      },
      { onConflict: "tx_hash,kind,user_id" },
    );
    if (transactionError) throw new Error(`Payout recording failed: ${transactionError.message}`);
  }

  await recordAuditEvent({
    matchId: match.id,
    actorUserId,
    eventType: "settlement_confirmed",
    txHash: settlementHash,
    idempotencyKey: `settlement_confirmed:${match.id}`,
    payload: { winnerId, winnerWallet, payout: payout.toString(), reconciled: !settlementHash },
  });

  const { error: completeError } = await supabaseAdmin
    .from("matches")
    .update({ status: "completed", winner_id: winnerId })
    .eq("id", match.id)
    .eq("winner_id", winnerId)
    .in("status", ["settling", "completed"]);
  if (completeError) throw new Error(`Match completion failed: ${completeError.message}`);

  await recordAuditEvent({
    matchId: match.id,
    actorUserId,
    eventType: "match_completed",
    idempotencyKey: `match_completed:${match.id}`,
    payload: { winnerId, payout: payout.toString(), txHash: settlementHash },
  });

  return { status: "completed" as const, winnerId, payout: payout.toString(), settlementHash };
}
