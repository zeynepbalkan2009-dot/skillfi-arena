import "server-only";

import { randomUUID } from "node:crypto";
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
type TxHash = `0x${string}`;
type SettlementLeaseClaim = { acquired: boolean; tx_hash: string | null };

export class MatchDisputedError extends Error {
  constructor() {
    super("Match is disputed on-chain; automatic settlement is paused");
    this.name = "MatchDisputedError";
  }
}

export class SettlementInProgressError extends Error {
  constructor() {
    super("Settlement is already being processed");
    this.name = "SettlementInProgressError";
  }
}

async function claimSettlementLease(matchId: string, leaseToken: string): Promise<SettlementLeaseClaim> {
  const { data, error } = await supabaseAdmin
    .rpc("claim_match_settlement", {
      p_match_id: matchId,
      p_lease_token: leaseToken,
      p_lease_seconds: 900,
    })
    .single();
  if (error) throw new Error(`Settlement lease claim failed: ${error.message}`);
  return data as SettlementLeaseClaim;
}

async function recordSettlementLeaseTx(matchId: string, leaseToken: string, txHash: TxHash): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc("record_match_settlement_tx", {
    p_match_id: matchId,
    p_lease_token: leaseToken,
    p_tx_hash: txHash,
  });
  if (error || data !== true) {
    throw new Error(`Settlement lease transaction recording failed${error ? `: ${error.message}` : ""}`);
  }
}

async function releaseSettlementLease(matchId: string, leaseToken: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc("release_match_settlement_lease", {
    p_match_id: matchId,
    p_lease_token: leaseToken,
  });
  if (error) console.error("Settlement lease release failed:", error.message);
}

async function clearConfirmedSettlementLease(matchId: string, txHash: TxHash): Promise<void> {
  const { error } = await supabaseAdmin
    .from("match_settlement_leases")
    .delete()
    .eq("match_id", matchId)
    .eq("tx_hash", txHash.toLowerCase());
  if (error) console.error("Confirmed settlement lease cleanup failed:", error.message);
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

  let settlementHash: TxHash | null = null;
  if (Number(onchain[6]) === 3) {
    const leaseToken = randomUUID();
    const lease = await claimSettlementLease(match.id, leaseToken);

    if (!lease.acquired) {
      if (!lease.tx_hash || !/^0x[0-9a-fA-F]{64}$/.test(lease.tx_hash)) {
        throw new SettlementInProgressError();
      }
      settlementHash = lease.tx_hash as TxHash;
      const existingReceipt = await escrowPublicClient.waitForTransactionReceipt({ hash: settlementHash });
      if (existingReceipt.status !== "success") {
        await clearConfirmedSettlementLease(match.id, settlementHash);
        throw new SettlementInProgressError();
      }
      onchain = await escrowPublicClient.readContract({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: skillFiEscrowAbi,
        functionName: "matches",
        args: [chainMatchId],
      });
      await clearConfirmedSettlementLease(match.id, settlementHash);
    } else {
      try {
        const walletClient = getEscrowWalletClient();
        settlementHash = await walletClient.writeContract({
          address: ESCROW_CONTRACT_ADDRESS,
          abi: skillFiEscrowAbi,
          functionName: "resolveMatch",
          args: [chainMatchId, winnerWallet as Address],
        });

        // The transaction hash is persisted before any other database/audit work.
        // Concurrent callers can observe this row and wait on the same hash instead
        // of broadcasting another operator transaction.
        await recordSettlementLeaseTx(match.id, leaseToken, settlementHash);

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
        if (pendingTransactionError) {
          console.error("Pending settlement recording failed:", pendingTransactionError.message);
        }
        try {
          await recordAuditEvent({
            matchId: match.id,
            actorUserId,
            eventType: "settlement_broadcast",
            txHash: settlementHash,
            idempotencyKey: `settlement_broadcast:${match.id}`,
            payload: { winnerId, winnerWallet, payout: payout.toString() },
          });
        } catch (auditError) {
          console.error("Settlement broadcast audit failed:", auditError instanceof Error ? auditError.message : auditError);
        }

        const receipt = await escrowPublicClient.waitForTransactionReceipt({ hash: settlementHash });
        if (receipt.status !== "success") {
          await releaseSettlementLease(match.id, leaseToken);
          throw new Error("Settlement transaction reverted");
        }
        onchain = await escrowPublicClient.readContract({
          address: ESCROW_CONTRACT_ADDRESS,
          abi: skillFiEscrowAbi,
          functionName: "matches",
          args: [chainMatchId],
        });
        await releaseSettlementLease(match.id, leaseToken);
      } catch (error) {
        // If no tx hash was broadcast, releasing the claim permits a later retry.
        // If a hash exists but could not be durably recorded, keep the 15-minute
        // lease rather than immediately risk a duplicate operator broadcast.
        if (!settlementHash) await releaseSettlementLease(match.id, leaseToken);
        onchain = await escrowPublicClient.readContract({
          address: ESCROW_CONTRACT_ADDRESS,
          abi: skillFiEscrowAbi,
          functionName: "matches",
          args: [chainMatchId],
        });
        if (Number(onchain[6]) !== 4) throw error;
      }
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
    settlementHash = (previousEvent?.tx_hash as TxHash | undefined) ?? null;
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
