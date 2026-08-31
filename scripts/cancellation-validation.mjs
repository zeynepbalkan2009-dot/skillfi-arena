import { createClient } from "@supabase/supabase-js";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

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
  const index = value.indexOf("https://");
  return index >= 0 ? value.slice(index).trim() : value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = loadEnv(".env.local");
const service = createClient(normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const rpcUrl = env.RPC_URL || env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL;
const account = privateKeyToAccount(env.OPERATOR_PRIVATE_KEY.startsWith("0x") ? env.OPERATOR_PRIVATE_KEY : `0x${env.OPERATOR_PRIVATE_KEY}`);
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, transport: http(rpcUrl) });
const abi = parseAbi([
  "function createMatch(uint256 matchId,uint256 entryFee)",
  "function matches(uint256) view returns(address player1,address player2,uint256 entryFee,uint256 createdAt,bool player1Deposited,bool player2Deposited,uint8 status)",
  "function cancelMatch(uint256 matchId)",
  "event MatchCancelled(uint256 indexed matchId)",
]);
const zero = "0x0000000000000000000000000000000000000000";

const { data: candidates, error: candidateError } = await service
  .from("matches")
  .select("id,smart_contract_match_id,player_a_id,status")
  .eq("status", "waiting_on_chain")
  .order("created_at", { ascending: false });
assert(!candidateError, `Candidate lookup failed: ${candidateError?.message}`);

let selected;
let chainMatch;
for (const candidate of candidates ?? []) {
  const current = await publicClient.readContract({
    address: env.NEXT_PUBLIC_ESCROW_ADDRESS,
    abi,
    functionName: "matches",
    args: [BigInt(candidate.smart_contract_match_id)],
  });
  if ([1, 6].includes(Number(current[6])) && current[0].toLowerCase() === zero && current[1].toLowerCase() === zero) {
    selected = candidate;
    chainMatch = current;
    break;
  }
}
if (!selected || !chainMatch) {
  const operatorWallet = account.address.toLowerCase();
  let { data: operatorUser, error: userError } = await service
    .from("users")
    .select("id")
    .ilike("wallet_address", operatorWallet)
    .maybeSingle();
  assert(!userError, `Operator user lookup failed: ${userError?.message}`);
  if (!operatorUser) {
    const suffix = operatorWallet.slice(-8);
    const created = await service.from("users").insert({
      username: `validation_operator_${suffix}`,
      region: "EU",
      wallet_address: operatorWallet,
      privy_user_id: `validation:operator:${operatorWallet}`,
    }).select("id").single();
    assert(!created.error && created.data, `Operator validation user creation failed: ${created.error?.message}`);
    operatorUser = created.data;
  }
  const { data: pilotGame, error: gameError } = await service
    .from("games")
    .select("id")
    .eq("slug", "typing-sprint")
    .eq("is_active", true)
    .maybeSingle();
  assert(!gameError && pilotGame, "Typing Sprint pilot game is required before creating a cancellation fixture");

  const generatedMatchId = BigInt(`0x${randomBytes(32).toString("hex")}`);
  const createHash = await walletClient.writeContract({
    address: env.NEXT_PUBLIC_ESCROW_ADDRESS,
    abi,
    functionName: "createMatch",
    args: [generatedMatchId, 1n],
  });
  const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
  assert(createReceipt.status === "success", "Cancellation fixture creation reverted");
  const { data: inserted, error: insertError } = await service.from("matches").insert({
    smart_contract_match_id: generatedMatchId.toString(),
    game_id: pilotGame.id,
    player_a_id: operatorUser.id,
    player_b_id: null,
    stake_amount: "1",
    status: "waiting_on_chain",
  }).select("id,smart_contract_match_id,player_a_id,status").single();
  assert(!insertError && inserted, `Cancellation fixture indexing failed: ${insertError?.message}`);
  selected = inserted;
  chainMatch = await publicClient.readContract({
    address: env.NEXT_PUBLIC_ESCROW_ADDRESS,
    abi,
    functionName: "matches",
    args: [generatedMatchId],
  });
}

const chainId = BigInt(selected.smart_contract_match_id);
let hash;
if (Number(chainMatch[6]) === 1) {
  hash = await walletClient.writeContract({
    address: env.NEXT_PUBLIC_ESCROW_ADDRESS,
    abi,
    functionName: "cancelMatch",
    args: [chainId],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  assert(receipt.status === "success", "Cancellation reverted");
} else {
  const latestBlock = await publicClient.getBlockNumber();
  for (let offset = 0n; offset < 100_000n && !hash; offset += 9_999n) {
    const toBlock = latestBlock - offset;
    const fromBlock = toBlock > 9_998n ? toBlock - 9_998n : 0n;
    const logs = await publicClient.getLogs({
      address: env.NEXT_PUBLIC_ESCROW_ADDRESS,
      event: abi.find((item) => item.type === "event" && item.name === "MatchCancelled"),
      args: { matchId: chainId },
      fromBlock,
      toBlock,
    });
    hash = logs.at(-1)?.transactionHash;
  }
}
assert(hash, "Cancellation transaction hash could not be recovered");
let after = await publicClient.readContract({
  address: env.NEXT_PUBLIC_ESCROW_ADDRESS,
  abi,
  functionName: "matches",
  args: [chainId],
});
for (let attempt = 0; attempt < 5 && Number(after[6]) !== 6; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  after = await publicClient.readContract({ address: env.NEXT_PUBLIC_ESCROW_ADDRESS, abi, functionName: "matches", args: [chainId] });
}
assert(Number(after[6]) === 6, `Unexpected post-cancellation state ${Number(after[6])}`);

await service.from("matches").update({ status: "cancelled" }).eq("id", selected.id).throwOnError();
await service
  .from("risk_stake_reservations")
  .update({ status: "released", updated_at: new Date().toISOString() })
  .eq("match_id", selected.id)
  .in("status", ["reserved", "confirmed"])
  .throwOnError();
const { error: auditError } = await service.from("match_audit_events").insert({
  match_id: selected.id,
  actor_user_id: selected.player_a_id,
  event_type: "match_cancelled",
  tx_hash: hash.toLowerCase(),
  idempotency_key: `match_cancelled:${selected.id}`,
  payload: { refundedUsers: 0, amountEach: chainMatch[2].toString(), validationRun: true },
});
assert(!auditError || auditError.code === "23505", `Audit write failed: ${auditError?.message}`);

console.log(JSON.stringify({
  matchId: selected.id,
  smartContractMatchId: selected.smart_contract_match_id,
  transactionHash: hash,
  onchainStatus: Number(after[6]),
  databaseStatus: "cancelled",
  refundedUsers: 0,
  escrowWasEmpty: true,
}, null, 2));
