import { createHash, randomBytes } from "node:crypto";
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

function normalizeUrl(value = "") {
  const i = value.indexOf("https://");
  return i >= 0 ? value.slice(i).trim() : value;
}

const env = loadEnv(".env.local");
const studioName = process.argv[2] || "SkillFi Test Studio";
const gameName = process.argv[3] || "SkillFi Integration Test";
const admin = createClient(normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: studio, error: studioError } = await admin.from("studios")
  .select("id,owner_user_id,status")
  .eq("name", studioName)
  .single();
if (studioError || !studio || studio.status !== "approved") throw new Error("Fixture studio must be approved");
const { data: game, error: gameError } = await admin.from("games")
  .select("id,integration_status")
  .eq("studio_id", studio.id)
  .eq("name", gameName)
  .single();
if (gameError || !game || game.integration_status !== "sandbox") throw new Error("Fixture game must be in sandbox");
const { data: existing, error: existingError } = await admin.from("game_api_credentials")
  .select("id,key_prefix,revoked_at")
  .eq("game_id", game.id)
  .eq("name", `${gameName} fixture key`)
  .is("revoked_at", null)
  .maybeSingle();
if (existingError) throw new Error(`Credential lookup failed: ${existingError.message}`);
if (existing) {
  console.log(JSON.stringify({ created: false, credential: existing, warning: "Existing secrets cannot be recovered; revoke it before creating a replacement." }, null, 2));
  process.exit(0);
}

const token = randomBytes(32).toString("base64url");
const prefix = `sk_test_${token.slice(0, 8)}`;
const secret = `${prefix}_${token}`;
const secretHash = createHash("sha256").update(secret, "utf8").digest("hex");
const scopes = ["game:read", "results:write"];
const { data: credential, error: credentialError } = await admin.from("game_api_credentials").insert({
  game_id: game.id,
  studio_id: studio.id,
  name: `${gameName} fixture key`,
  key_prefix: prefix,
  secret_hash: secretHash,
  scopes,
  created_by_user_id: studio.owner_user_id,
}).select("id,game_id,name,key_prefix,scopes,created_at").single();
if (credentialError || !credential) throw new Error(`Credential creation failed: ${credentialError?.message}`);
const { error: auditError } = await admin.from("studio_audit_events").insert({
  studio_id: studio.id,
  game_id: game.id,
  actor_user_id: studio.owner_user_id,
  event_type: "game_credential_created",
  idempotency_key: `game_credential_created:${credential.id}`,
  payload: { credentialId: credential.id, keyPrefix: prefix, scopes, fixture: true },
});
if (auditError) throw new Error(`Credential audit failed: ${auditError.message}`);
console.log(JSON.stringify({ created: true, credential, secret, warning: "Store this secret now; it cannot be recovered." }, null, 2));
