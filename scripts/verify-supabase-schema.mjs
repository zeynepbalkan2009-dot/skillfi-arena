import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadDotEnv(path) {
  const env = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    const key = line.slice(0, separator).replace(/^export\s+/, "").trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

function normalizeUrl(value) {
  const text = value ?? "";
  const index = text.includes("https://") ? text.indexOf("https://") : text.indexOf("http://");
  return index >= 0 ? text.slice(index).trim() : text;
}

function usableKey(value) {
  return value && !/[<>]|your-|placeholder/i.test(value);
}

const env = loadDotEnv(".env.local");
const supabaseUrl = normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL);
const anonKey = usableKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ? env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  : env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
  throw new Error("Missing required Supabase URL, anon/publishable key, or service-role key.");
}

const service = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const checks = [];
for (const table of [
  "users",
  "games",
  "matches",
  "challenges",
  "challenge_participants",
  "match_participants",
  "guilds",
  "guild_members",
  "guild_proposals",
  "guild_votes",
  "guild_treasury_events",
  "beta_pilot_enrollments",
]) {
  const result = await service.from(table).select("*", { head: true, count: "exact" }).limit(1);
  checks.push({ object: `public.${table}`, ok: !result.error, error: result.error?.message ?? null });
}

const rpc = await service.rpc("accept_challenge", {
  p_challenge_id: "00000000-0000-0000-0000-000000000000",
  p_player_id: "00000000-0000-0000-0000-000000000000",
});
checks.push({
  object: "public.accept_challenge RPC",
  ok: Boolean(rpc.error && /challenge not found/i.test(rpc.error.message)),
  error: rpc.error?.message ?? null,
});

console.log(JSON.stringify(checks, null, 2));
