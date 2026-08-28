import { createClient } from "@supabase/supabase-js";
import { createPublicClient, createWalletClient, getAddress, http, keccak256, parseAbi, parseAbiItem, stringToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8").split(/\r?\n/).map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => { const i = line.indexOf("="); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; }),
  );
}
function normalizeUrl(value = "") { const i = value.indexOf("https://"); return i >= 0 ? value.slice(i).trim() : value; }
function assert(condition, message) { if (!condition) throw new Error(message); }

const [matchUuid, winnerUuid] = process.argv.slice(2);
assert(matchUuid && winnerUuid, "Usage: npm run resolve:dispute -- <match-uuid> <winner-user-uuid>");
const env = loadEnv(".env.local");
const service = createClient(normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const rpcUrl = env.RPC_URL || env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL;
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const chainId = await publicClient.getChainId();
const rawArbiterKey = env.ARBITER_PRIVATE_KEY || (chainId === 84532 ? env.OPERATOR_PRIVATE_KEY : null);
assert(rawArbiterKey, "ARBITER_PRIVATE_KEY is required outside Base Sepolia test validation");
const arbiter = privateKeyToAccount(rawArbiterKey.startsWith("0x") ? rawArbiterKey : `0x${rawArbiterKey}`);
const walletClient = createWalletClient({ account: arbiter, transport: http(rpcUrl) });
const abi = parseAbi([
  "function matches(uint256) view returns(address player1,address player2,uint256 entryFee,uint256 createdAt,bool player1Deposited,bool player2Deposited,uint8 status)",
  "function platformFeeBps() view returns(uint256)",
  "function hasRole(bytes32,address) view returns(bool)",
  "function resolveDispute(uint256 matchId,address winner)",
]);
const resolvedEvent = parseAbiItem("event MatchResolved(uint256 indexed matchId, address indexed winner, uint256 prize)");

async function findResolution(matchId) {
  const latestBlock = await publicClient.getBlockNumber();
  for (let offset = 0n; offset < 500_000n; offset += 9_999n) {
    const toBlock = latestBlock > offset ? latestBlock - offset : 0n;
    const fromBlock = toBlock > 9_998n ? toBlock - 9_998n : 0n;
    const logs = await publicClient.getLogs({
      address: getAddress(env.NEXT_PUBLIC_ESCROW_ADDRESS), event: resolvedEvent,
      args: { matchId }, fromBlock, toBlock,
    });
    if (logs.length) return logs.at(-1);
    if (fromBlock === 0n) break;
  }
  return null;
}

const { data: match, error: matchError } = await service
  .from("matches").select("id,smart_contract_match_id,player_a_id,player_b_id,status,winner_id")
  .eq("id", matchUuid).single();
assert(!matchError && match, `Match lookup failed: ${matchError?.message}`);
assert(match.status === "disputed", `Database match must be disputed, received ${match.status}`);
assert([match.player_a_id, match.player_b_id].includes(winnerUuid), "Winner must be a match participant");

const { data: players, error: playerError } = await service.from("users").select("id,wallet_address").in("id", [match.player_a_id, match.player_b_id]);
assert(!playerError && players?.length === 2, `Participant lookup failed: ${playerError?.message}`);
const wallets = new Map(players.map((player) => [player.id, player.wallet_address]));
assert(wallets.get(match.player_a_id), "Player A does not have a verified wallet");
assert(wallets.get(match.player_b_id), "Player B does not have a verified wallet");
const playerAWallet = getAddress(wallets.get(match.player_a_id));
const playerBWallet = getAddress(wallets.get(match.player_b_id));
const winnerWallet = getAddress(wallets.get(winnerUuid));

const chainMatchId = BigInt(match.smart_contract_match_id);
const onchain = await publicClient.readContract({ address: env.NEXT_PUBLIC_ESCROW_ADDRESS, abi, functionName: "matches", args: [chainMatchId] });
assert([4, 5].includes(Number(onchain[6])), `On-chain match must be disputed or resolved, received ${Number(onchain[6])}`);
assert([getAddress(onchain[0]), getAddress(onchain[1])].includes(playerAWallet), "Player A wallet mismatch");
assert([getAddress(onchain[0]), getAddress(onchain[1])].includes(playerBWallet), "Player B wallet mismatch");
assert([getAddress(onchain[0]), getAddress(onchain[1])].includes(winnerWallet), "Winner wallet mismatch");
const arbiterRole = keccak256(stringToBytes("ARBITER_ROLE"));
const hasRole = await publicClient.readContract({ address: env.NEXT_PUBLIC_ESCROW_ADDRESS, abi, functionName: "hasRole", args: [arbiterRole, arbiter.address] });
assert(hasRole, `Configured signer ${arbiter.address} does not have ARBITER_ROLE`);

const feeBps = await publicClient.readContract({ address: env.NEXT_PUBLIC_ESCROW_ADDRESS, abi, functionName: "platformFeeBps" });
const totalPrize = onchain[2] * 2n;
const payout = totalPrize - (totalPrize * feeBps) / 10_000n;
let hash;
let recovered = false;
if (Number(onchain[6]) === 5) {
  hash = await walletClient.writeContract({ address: env.NEXT_PUBLIC_ESCROW_ADDRESS, abi, functionName: "resolveDispute", args: [chainMatchId, winnerWallet] });
  await service.from("transactions").upsert({ user_id: winnerUuid, match_id: match.id, tx_hash: hash.toLowerCase(), kind: "settlement", amount: payout.toString(), status: "pending" }, { onConflict: "tx_hash,kind,user_id" }).throwOnError();
  const { error: broadcastError } = await service.from("match_audit_events").insert({
    match_id: match.id, actor_user_id: null, event_type: "dispute_resolution_broadcast", tx_hash: hash.toLowerCase(),
    idempotency_key: `dispute_resolution_broadcast:${match.id}`, payload: { winnerId: winnerUuid, winnerWallet, payout: payout.toString(), arbiter: arbiter.address },
  });
  assert(!broadcastError || broadcastError.code === "23505", `Broadcast audit write failed: ${broadcastError?.message}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  assert(receipt.status === "success", "Dispute resolution reverted");
} else {
  const resolvedLog = await findResolution(chainMatchId);
  assert(resolvedLog?.transactionHash, "Resolved match found, but its MatchResolved event was not found");
  assert(getAddress(resolvedLog.args.winner) === winnerWallet, `On-chain winner is ${resolvedLog.args.winner}, not requested winner ${winnerWallet}`);
  assert(resolvedLog.args.prize === payout, `On-chain payout ${resolvedLog.args.prize} does not match expected payout ${payout}`);
  hash = resolvedLog.transactionHash;
  recovered = true;
}
await service.from("transactions").upsert({ user_id: winnerUuid, match_id: match.id, tx_hash: hash.toLowerCase(), kind: "settlement", amount: payout.toString(), status: "confirmed" }, { onConflict: "tx_hash,kind,user_id" }).throwOnError();
const { data: completedMatch, error: completionError } = await service.from("matches").update({ status: "completed", winner_id: winnerUuid }).eq("id", match.id).eq("status", "disputed").select("id").maybeSingle();
assert(!completionError && completedMatch, `Match completion failed: ${completionError?.message ?? "state changed concurrently"}`);
const { error: auditError } = await service.from("match_audit_events").insert({
  match_id: match.id, actor_user_id: null, event_type: "dispute_resolved", tx_hash: hash.toLowerCase(),
  idempotency_key: `dispute_resolved:${match.id}`, payload: { winnerId: winnerUuid, winnerWallet, payout: payout.toString(), arbiter: arbiter.address, recovered },
});
assert(!auditError || auditError.code === "23505", `Audit write failed: ${auditError?.message}`);
console.log(JSON.stringify({ matchId: match.id, winnerId: winnerUuid, winnerWallet, payout: payout.toString(), transactionHash: hash, recovered, status: "completed" }, null, 2));
