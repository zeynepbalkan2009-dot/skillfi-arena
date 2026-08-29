import { createClient } from "@supabase/supabase-js";
import { parseUnits } from "viem";
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
const feeUsdc = process.argv[3];
if (!studioName || !feeUsdc) throw new Error("Usage: node scripts/set-studio-fee.mjs <studio-name> <fee-usdc>");

const amount = parseUnits(feeUsdc, 6);
if (amount < 0n) throw new Error("Fee cannot be negative");

const env = loadEnv(".env.local");
const admin = createClient(normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: current, error: lookupError } = await admin.from("studios")
  .select("id,owner_user_id,status,listing_fee_amount")
  .eq("name", studioName)
  .single();
if (lookupError || !current) throw new Error(`Studio lookup failed: ${lookupError?.message}`);
if (current.status !== "pending_payment") throw new Error(`Only pending_payment studios can be adjusted (current: ${current.status})`);

const { data: updated, error: updateError } = await admin.from("studios")
  .update({ listing_fee_amount: amount.toString() })
  .eq("id", current.id)
  .eq("listing_fee_amount", current.listing_fee_amount)
  .select("id,status,listing_fee_amount")
  .single();
if (updateError || !updated) throw new Error(`Fee update failed: ${updateError?.message}`);

const key = `listing_fee_adjusted:${current.listing_fee_amount}:${amount}`;
const { error: auditError } = await admin.from("studio_audit_events").insert({
  studio_id: current.id,
  actor_user_id: current.owner_user_id,
  event_type: "listing_fee_adjusted",
  idempotency_key: key,
  payload: { previous_amount: current.listing_fee_amount, amount: amount.toString(), currency: "USDC" },
});
if (auditError && auditError.code !== "23505") throw new Error(`Audit insert failed: ${auditError.message}`);

console.log(JSON.stringify({ studioName, previousAmount: current.listing_fee_amount, ...updated }, null, 2));
