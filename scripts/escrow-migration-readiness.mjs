import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/)
  .map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
const normalizeUrl = (value = "") => value.slice(value.indexOf("https://")).trim();
const rawKey = env.OPERATOR_PRIVATE_KEY;
if (!rawKey) throw new Error("OPERATOR_PRIVATE_KEY is required");
const account = privateKeyToAccount(rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`);
const service = createClient(normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const client = createPublicClient({ transport: http(env.RPC_URL || env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL) });

const { data, count, error } = await service.from("matches")
  .select("id,status,smart_contract_match_id", { count: "exact" })
  .in("status", ["waiting", "active", "disputed", "settling"])
  .not("smart_contract_match_id", "is", null);
if (error) throw new Error(`Could not inspect active escrow state: ${error.message}`);
const [chainId, nativeGasBalance] = await Promise.all([
  client.getChainId(),
  client.getBalance({ address: account.address }),
]);
const statuses = Object.fromEntries(["waiting", "active", "disputed", "settling"].map((status) => [status, (data ?? []).filter((match) => match.status === status).length]));
const nonTerminalOnchainMatches = count ?? data?.length ?? 0;

console.log(JSON.stringify({
  safeToReplaceEscrow: nonTerminalOnchainMatches === 0,
  chainId,
  operator: `${account.address.slice(0, 6)}…${account.address.slice(-4)}`,
  nativeGasBalance: nativeGasBalance.toString(),
  hasDeploymentGas: nativeGasBalance > 0n,
  nonTerminalOnchainMatches,
  statuses,
}, null, 2));

if (chainId !== 5_042_002 || nativeGasBalance === 0n || nonTerminalOnchainMatches !== 0) process.exitCode = 1;
