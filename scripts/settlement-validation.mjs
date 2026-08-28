import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createPublicClient, http, parseAbiItem } from "viem";

function loadEnv(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")];
      }),
  );
}

function normalizeUrl(value = "") {
  const index = value.includes("https://") ? value.indexOf("https://") : value.indexOf("http://");
  return index >= 0 ? value.slice(index).trim() : value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = loadEnv(".env.local");
const service = createClient(normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const chain = createPublicClient({ transport: http(env.RPC_URL || env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL) });

let { data: audit, error: auditError } = await service
  .from("match_audit_events")
  .select("match_id,tx_hash,payload")
  .eq("event_type", "settlement_confirmed")
  .not("tx_hash", "is", null)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
assert(!auditError, `Settlement audit lookup failed: ${auditError?.message}`);

if (!audit?.tx_hash) {
  const { data: legacyMatch, error: legacyError } = await service
    .from("matches")
    .select("id,smart_contract_match_id,winner_id,stake_amount,status")
    .eq("status", "completed")
    .not("winner_id", "is", null)
    .not("smart_contract_match_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  assert(!legacyError && legacyMatch, `Legacy completed match unavailable: ${legacyError?.message}`);

  const latestBlock = await chain.getBlockNumber();
  const resolvedEvent = parseAbiItem("event MatchResolved(uint256 indexed matchId, address indexed winner, uint256 prize)");
  let resolvedLog;
  for (let offset = 0n; offset < 100_000n && !resolvedLog; offset += 9_999n) {
    const toBlock = latestBlock - offset;
    const fromBlock = toBlock > 9_998n ? toBlock - 9_998n : 0n;
    const logs = await chain.getLogs({
      address: env.NEXT_PUBLIC_ESCROW_ADDRESS,
      event: resolvedEvent,
      args: { matchId: BigInt(legacyMatch.smart_contract_match_id) },
      fromBlock,
      toBlock,
    });
    resolvedLog = logs.at(-1);
  }
  assert(resolvedLog?.transactionHash, "Resolved on-chain event was not found in the recent block window");
  const payout = resolvedLog.args.prize?.toString() ?? null;
  const { error: backfillAuditError } = await service.from("match_audit_events").insert({
    match_id: legacyMatch.id,
    actor_user_id: null,
    event_type: "settlement_confirmed",
    tx_hash: resolvedLog.transactionHash.toLowerCase(),
    idempotency_key: `settlement_confirmed:${legacyMatch.id}`,
    payload: { winnerId: legacyMatch.winner_id, payout, reconciledFromChain: true },
  });
  assert(!backfillAuditError || backfillAuditError.code === "23505", `Settlement audit backfill failed: ${backfillAuditError?.message}`);
  audit = { match_id: legacyMatch.id, tx_hash: resolvedLog.transactionHash.toLowerCase(), payload: { payout } };
}

const { data: match, error: matchError } = await service
  .from("matches")
  .select("id,winner_id,stake_amount,status")
  .eq("id", audit.match_id)
  .eq("status", "completed")
  .not("winner_id", "is", null)
  .single();
assert(!matchError && match, `Completed match unavailable: ${matchError?.message ?? "no fixture"}`);

const expectedAmount = audit.payload?.payout ?? null;
const { data: existing, error: transactionReadError } = await service
  .from("transactions")
  .select("id,user_id,match_id,tx_hash,kind,amount,status")
  .eq("tx_hash", audit.tx_hash)
  .maybeSingle();
assert(!transactionReadError, `Transaction read failed: ${transactionReadError?.message ?? "unknown error"}`);

let transaction = existing;
if (!transaction) {
  const { data: inserted, error: insertError } = await service
    .from("transactions")
    .insert({
      user_id: match.winner_id,
      match_id: match.id,
      tx_hash: audit.tx_hash,
      kind: "settlement",
      amount: expectedAmount,
      status: "confirmed",
    })
    .select("id,user_id,match_id,tx_hash,kind,amount,status")
    .single();
  assert(!insertError, `Payout backfill failed: ${insertError?.message}`);
  transaction = inserted;
}

assert(transaction.user_id === match.winner_id, "Payout winner mismatch");
assert(transaction.match_id === match.id, "Payout match mismatch");
assert(transaction.kind === "settlement" && transaction.status === "confirmed", "Payout state mismatch");
const { error: compositeIdentityError } = await service.from("transactions").upsert(
  {
    user_id: transaction.user_id,
    match_id: transaction.match_id,
    tx_hash: transaction.tx_hash,
    kind: transaction.kind,
    amount: transaction.amount,
    status: transaction.status,
  },
  { onConflict: "tx_hash,kind,user_id" },
);
assert(!compositeIdentityError, `Composite transaction identity unavailable: ${compositeIdentityError?.message}`);
console.log(JSON.stringify({
  matchId: match.id,
  winnerId: match.winner_id,
  settlementTx: audit.tx_hash,
  payoutRecorded: true,
  compositeTransactionIdentity: true,
  amount: transaction.amount,
}, null, 2));
