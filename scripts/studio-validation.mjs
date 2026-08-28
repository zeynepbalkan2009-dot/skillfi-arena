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
const url = normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL);
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const publicClient = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const tables = ["studios", "studio_fee_payments", "studio_audit_events", "game_api_credentials", "game_result_submissions"];
const counts = {};
for (const table of tables) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true });
  assert(!error, `${table} is unavailable: ${error?.message}`);
  counts[table] = count ?? 0;
  const { error: publicError } = await publicClient.from(table).select("id").limit(1);
  assert(publicError, `${table} must not be publicly readable`);
}
const { data: publicGames, error: gamesError } = await publicClient.from("games").select("id,is_active,integration_status");
assert(!gamesError, `Public games query failed: ${gamesError?.message}`);
assert((publicGames ?? []).every((game) => game.is_active === true && game.integration_status === "published"), "Public catalog exposed a draft or inactive game");
console.log(JSON.stringify({ hostedStudioSchema: true, privateTablesBlocked: true, publicCatalogPolicy: true, publicGames: publicGames?.length ?? 0, counts }, null, 2));

