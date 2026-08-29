import { createClient } from "@supabase/supabase-js";
import { createPublicClient, erc20Abi, getAddress, http, parseEventLogs } from "viem";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    }));
}

function normalizeUrl(value = "") {
  const i = value.indexOf("https://");
  return i >= 0 ? value.slice(i).trim() : value;
}

const studioName = process.argv[2];
if (!studioName) throw new Error("Usage: node scripts/reconcile-studio-fee.mjs <studio-name>");

const env = loadEnv(".env.local");
const admin = createClient(normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const client = createPublicClient({ transport: http(env.RPC_URL || env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL) });
const token = getAddress(env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS);
const treasury = getAddress(env.STUDIO_FEE_TREASURY_ADDRESS || env.OPERATOR_WALLET_ADDRESS);

const { data: studio, error: studioError } = await admin.from("studios")
  .select("id,owner_user_id,status,listing_fee_amount")
  .eq("name", studioName)
  .single();
if (studioError || !studio) throw new Error(`Studio lookup failed: ${studioError?.message}`);
if (!["pending_payment", "pending_review"].includes(studio.status)) throw new Error(`Studio is not awaiting payment (current: ${studio.status})`);

const { data: owner, error: ownerError } = await admin.from("users")
  .select("wallet_address")
  .eq("id", studio.owner_user_id)
  .single();
if (ownerError || !owner?.wallet_address) throw new Error(`Owner lookup failed: ${ownerError?.message}`);
const payer = getAddress(owner.wallet_address);
const amount = BigInt(studio.listing_fee_amount);

const latest = await client.getBlockNumber();
let matching;
for (let cursor = latest; cursor >= 0n && !matching; cursor -= 500n) {
  const fromBlock = cursor > 499n ? cursor - 499n : 0n;
  const logs = await client.getLogs({
    address: token,
    event: erc20Abi.find((item) => item.type === "event" && item.name === "Transfer"),
    args: { from: payer, to: treasury },
    fromBlock,
    toBlock: cursor,
  });
  matching = [...logs].reverse().find((log) => log.args.value === amount);
  if (latest - fromBlock >= 10_000n) break;
}
if (!matching?.transactionHash) throw new Error("No matching confirmed studio fee transfer found in the latest 10,000 blocks");

const receipt = await client.getTransactionReceipt({ hash: matching.transactionHash });
if (receipt.status !== "success" || !receipt.to || getAddress(receipt.to) !== token || getAddress(receipt.from) !== payer) {
  throw new Error("Matching transfer transaction failed receipt validation");
}
const validTransfer = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: "Transfer" }).some((log) =>
  getAddress(log.args.from) === payer && getAddress(log.args.to) === treasury && log.args.value === amount
);
if (!validTransfer) throw new Error("Receipt does not contain the exact configured transfer");

const txHash = matching.transactionHash.toLowerCase();
const payment = {
  studio_id: studio.id,
  payer_user_id: studio.owner_user_id,
  tx_hash: txHash,
  token_address: token,
  treasury_address: treasury,
  amount: amount.toString(),
  chain_id: (await client.getChainId()).toString(),
  status: "confirmed",
};
const { error: paymentError } = await admin.from("studio_fee_payments").insert(payment);
if (paymentError?.code === "23505") {
  const { data: existing } = await admin.from("studio_fee_payments")
    .select("studio_id,payer_user_id,amount")
    .eq("tx_hash", txHash)
    .maybeSingle();
  if (!existing || existing.studio_id !== studio.id || existing.payer_user_id !== studio.owner_user_id || BigInt(existing.amount) !== amount) {
    throw new Error("Transaction was already used for another studio fee");
  }
} else if (paymentError) throw new Error(`Payment record failed: ${paymentError.message}`);

const { data: updated, error: updateError } = await admin.from("studios")
  .update({ status: "pending_review" })
  .eq("id", studio.id)
  .in("status", ["pending_payment", "pending_review"])
  .select("id,status")
  .single();
if (updateError || !updated) throw new Error(`Studio status update failed: ${updateError?.message}`);

const { error: auditError } = await admin.from("studio_audit_events").insert({
  studio_id: studio.id,
  actor_user_id: studio.owner_user_id,
  event_type: "listing_fee_confirmed",
  idempotency_key: `listing_fee_confirmed:${txHash}`,
  payload: { txHash, amount: amount.toString(), reconciled: true },
});
if (auditError && auditError.code !== "23505") throw new Error(`Audit insert failed: ${auditError.message}`);

console.log(JSON.stringify({ studioName, status: updated.status, txHash, amount: amount.toString() }, null, 2));
