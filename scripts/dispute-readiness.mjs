import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createPublicClient, getAddress, http, keccak256, parseAbi, stringToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

function loadEnv(path) {
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
}

function normalizeUrl(value = "") {
  const index = value.indexOf("https://");
  return index >= 0 ? value.slice(index).trim() : value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = loadEnv(".env.local");
const rpcUrl = env.RPC_URL || env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL;
const escrowAddress = getAddress(env.NEXT_PUBLIC_ESCROW_ADDRESS);
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const chainId = await publicClient.getChainId();
const rawArbiterKey = env.ARBITER_PRIVATE_KEY || env.OPERATOR_PRIVATE_KEY;
assert(rawArbiterKey, "ARBITER_PRIVATE_KEY or OPERATOR_PRIVATE_KEY is required");
const arbiter = privateKeyToAccount(rawArbiterKey.startsWith("0x") ? rawArbiterKey : `0x${rawArbiterKey}`);
const service = createClient(normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const abi = parseAbi([
  "function hasRole(bytes32,address) view returns(bool)",
  "function matches(uint256) view returns(address player1,address player2,uint256 entryFee,uint256 createdAt,bool player1Deposited,bool player2Deposited,uint8 status)",
]);

const code = await publicClient.getCode({ address: escrowAddress });
assert(code && code !== "0x", "Escrow contract is not deployed on the configured chain");
const arbiterRole = keccak256(stringToBytes("ARBITER_ROLE"));
const operatorRole = keccak256(stringToBytes("OPERATOR_ROLE"));
const defaultAdminRole = `0x${"0".repeat(64)}`;
const [hasArbiterRole, hasOperatorRole, hasAdminRole] = await Promise.all([
  publicClient.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [arbiterRole, arbiter.address] }),
  publicClient.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [operatorRole, arbiter.address] }),
  publicClient.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [defaultAdminRole, arbiter.address] }),
]);

const { data: matches, error } = await service.from("matches")
  .select("id,status,smart_contract_match_id,player_a_id,player_b_id,created_at")
  .in("status", ["active", "disputed"])
  .not("smart_contract_match_id", "is", null)
  .order("created_at", { ascending: false })
  .limit(25);
assert(!error, `Could not load dispute candidates: ${error?.message}`);

const candidates = [];
for (const match of matches ?? []) {
  if (!match.player_a_id || !match.player_b_id) continue;
  try {
    const onchain = await publicClient.readContract({ address: escrowAddress, abi, functionName: "matches", args: [BigInt(match.smart_contract_match_id)] });
    const chainStatus = Number(onchain[6]);
    if (chainStatus === 4 || chainStatus === 5) candidates.push({
      matchId: match.id,
      databaseStatus: match.status,
      chainStatus,
      action: chainStatus === 5 ? "resolve" : "participant-dispute-required",
    });
  } catch {
    // Ignore stale or invalid historical identifiers; this command is a readiness report.
  }
}

console.log(JSON.stringify({
  ready: hasArbiterRole,
  chainId,
  escrowDeployed: true,
  roles: { arbiter: hasArbiterRole, operator: hasOperatorRole, admin: hasAdminRole },
  arbiter: `${arbiter.address.slice(0, 6)}…${arbiter.address.slice(-4)}`,
  pendingResolutionCount: candidates.filter((candidate) => candidate.action === "resolve").length,
  candidateCount: candidates.length,
  candidates,
  nextAction: !hasArbiterRole
    ? "Grant ARBITER_ROLE to the configured signer from the contract admin wallet"
    : candidates.some((candidate) => candidate.action === "resolve")
    ? "Run resolve:dispute with an explicitly selected winner"
    : "A participant must submit a dispute from the match UI before arbitration can be exercised",
}, null, 2));

if (!hasArbiterRole) process.exitCode = 1;
