import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    }));
}

const env = loadEnv(".env.integration.local");
const appEnv = loadEnv(".env.local");
const secret = env.SKILLFI_TEST_API_KEY;
if (!secret) throw new Error("SKILLFI_TEST_API_KEY is missing from .env.integration.local");
const normalizeUrl = (value = "") => value.includes("https://") ? value.slice(value.indexOf("https://")).trim() : value;
const admin = createClient(normalizeUrl(appEnv.NEXT_PUBLIC_SUPABASE_URL), appEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const matchId = "00000000-0000-4000-8000-504200200001";
const { data: priorMatch } = await admin.from("matches").select("id,status,winner_id").eq("id", matchId).maybeSingle();
const { data: walletRows, error: walletError } = await admin.from("users").select("id,wallet_address").not("wallet_address", "is", null).limit(20);
const players = (walletRows ?? []).filter((row) => /^0x[0-9a-fA-F]{40}$/.test(row.wallet_address ?? "")).slice(0, 2);
if (walletError || players.length !== 2) throw new Error("Two fixture users with valid wallets are required");
if (!priorMatch) {
  const { error: matchError } = await admin.from("matches").insert({
    id: matchId, game_id: env.SKILLFI_TEST_GAME_ID, player_a_id: players[0].id, player_b_id: players[1].id,
    smart_contract_match_id: null, stake_amount: "0", status: "active", winner_id: null,
  });
  if (matchError) throw new Error(`Sandbox match creation failed: ${matchError.message}`);
}
const endpoint = `${process.env.SKILLFI_BASE_URL || "http://localhost:3000"}/api/integrations/v1/results`;
const rawBody = JSON.stringify({
  eventId: "sandbox_fixture_result_5042002",
  matchId,
  winnerWallet: players[0].wallet_address,
  occurredAt: new Date().toISOString(),
});
const timestamp = Date.now().toString();
const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
const headers = { "content-type": "application/json", authorization: `Bearer ${secret}`, "x-skillfi-timestamp": timestamp };

const invalid = await fetch(endpoint, { method: "POST", headers: { ...headers, "x-skillfi-signature": "0".repeat(64) }, body: rawBody });
const invalidBody = await invalid.json().catch(() => ({}));
if (invalid.status !== 401 || invalidBody.error !== "Invalid or expired request signature") {
  throw new Error(`Invalid-signature guard failed (${invalid.status}: ${JSON.stringify(invalidBody)})`);
}

let authenticatedBody = { status: "completed", sandbox: true };
if (priorMatch?.status !== "completed") {
  const authenticated = await fetch(endpoint, { method: "POST", headers: { ...headers, "x-skillfi-signature": signature }, body: rawBody });
  authenticatedBody = await authenticated.json().catch(() => ({}));
  if (authenticated.status !== 200 || authenticatedBody.status !== "completed" || authenticatedBody.sandbox !== true) {
    throw new Error(`Signed sandbox result failed (${authenticated.status}: ${JSON.stringify(authenticatedBody)})`);
  }
}
const { data: completed, error: completedError } = await admin.from("matches").select("status,winner_id").eq("id", matchId).single();
if (completedError || completed.status !== "completed" || completed.winner_id !== players[0].id) throw new Error("Sandbox match was not completed with the submitted winner");

console.log(JSON.stringify({ invalidSignatureRejected: true, signedCredentialAccepted: true, sandboxMatchCompleted: true, matchId, winnerId: completed.winner_id }, null, 2));
