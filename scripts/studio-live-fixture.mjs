import { createClient } from "@supabase/supabase-js";
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
const studioName = process.env.SKILLFI_FIXTURE_STUDIO || "SkillFi Test Studio";
const gameName = process.env.SKILLFI_FIXTURE_GAME || "SkillFi Integration Test";
const description = "Test game for validating SkillFi studio onboarding, signed result submission, and settlement integration.";

const { data: studio, error: studioError } = await admin.from("studios").select("id,owner_user_id,status").eq("name", studioName).single();
assert(!studioError && studio, `Fixture studio unavailable: ${studioError?.message}`);
let { data: game, error: gameError } = await admin.from("games").select("*").eq("studio_id", studio.id).eq("name", gameName).maybeSingle();
assert(!gameError, `Fixture game lookup failed: ${gameError?.message}`);
let created = false;
if (!game) {
  const slug = `${studio.id.slice(0, 8)}-${gameName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const result = await admin.from("games").insert({
    studio_id: studio.id, created_by_user_id: studio.owner_user_id, name: gameName, slug,
    type: "web2", description, website_url: null, integration_status: "draft", is_active: false,
  }).select("*").single();
  assert(!result.error && result.data, `Fixture game creation failed: ${result.error?.message}`);
  game = result.data;
  created = true;
}
assert(game.integration_status === "draft" && game.is_active === false, "Fixture game must remain a private inactive draft");
const { error: auditError } = await admin.from("studio_audit_events").insert({
  studio_id: studio.id, game_id: game.id, actor_user_id: studio.owner_user_id,
  event_type: "game_draft_created", idempotency_key: `game_draft_created:${game.id}`,
  payload: { name: game.name, fixture: true },
});
assert(!auditError || auditError.code === "23505", `Fixture audit failed: ${auditError?.message}`);
console.log(JSON.stringify({ studioId: studio.id, studioStatus: studio.status, gameId: game.id, gameStatus: game.integration_status, public: game.is_active, created }, null, 2));

