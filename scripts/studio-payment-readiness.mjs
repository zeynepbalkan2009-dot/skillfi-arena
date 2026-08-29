import { createClient } from "@supabase/supabase-js";
import { createPublicClient, erc20Abi, formatEther, formatUnits, getAddress, http } from "viem";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const i = line.indexOf("="); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
}
function normalizeUrl(value = "") { const i = value.indexOf("https://"); return i >= 0 ? value.slice(i).trim() : value; }
function assert(condition, message) { if (!condition) throw new Error(message); }

const env = loadEnv(".env.local");
const admin = createClient(normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: studio, error: studioError } = await admin.from("studios").select("id,owner_user_id,status,listing_fee_amount").eq("name", "SkillFi Test Studio").single();
assert(!studioError && studio, `Studio lookup failed: ${studioError?.message}`);
const { data: owner, error: ownerError } = await admin.from("users").select("wallet_address").eq("id", studio.owner_user_id).single();
assert(!ownerError && owner?.wallet_address, `Owner wallet lookup failed: ${ownerError?.message}`);
const wallet = getAddress(owner.wallet_address);
const token = getAddress(env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS);
const client = createPublicClient({ transport: http(env.RPC_URL || env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL) });
const [chainId, decimals, symbol, tokenBalance, nativeBalance] = await Promise.all([
  client.getChainId(),
  client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
  client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
  client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [wallet] }),
  client.getBalance({ address: wallet }),
]);
console.log(JSON.stringify({
  chainId, studioStatus: studio.status, wallet: `${wallet.slice(0, 6)}…${wallet.slice(-4)}`,
  listingFeeBaseUnits: studio.listing_fee_amount, listingFee: formatUnits(BigInt(studio.listing_fee_amount), decimals),
  token: symbol, tokenBalance: formatUnits(tokenBalance, decimals), nativeGasBalance: formatEther(nativeBalance),
  canPayToken: tokenBalance >= BigInt(studio.listing_fee_amount), canPayGas: nativeBalance > 0n,
}, null, 2));

