import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8").split(/\r?\n/).map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => { const i = line.indexOf("="); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; }),
  );
}

function normalizeUrl(value = "") {
  const secure = value.indexOf("https://");
  return secure >= 0 ? value.slice(secure).trim() : value;
}

const env = loadEnv(".env.local");
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase server credentials are missing from .env.local");
}

const service = createClient(normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL), env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: matches, error } = await service
  .from("matches")
  .select("id,smart_contract_match_id,player_a_id,player_b_id,stake_amount,updated_at")
  .eq("status", "disputed")
  .order("updated_at", { ascending: true });
if (error) throw new Error(`Dispute lookup failed: ${error.message}`);

const userIds = [...new Set((matches ?? []).flatMap((match) => [match.player_a_id, match.player_b_id]))];
const { data: users, error: usersError } = userIds.length
  ? await service.from("users").select("id,username,wallet_address").in("id", userIds)
  : { data: [], error: null };
if (usersError) throw new Error(`Participant lookup failed: ${usersError.message}`);
const userById = new Map((users ?? []).map((user) => [user.id, user]));

console.log(JSON.stringify({
  count: matches?.length ?? 0,
  disputes: (matches ?? []).map((match) => ({
    matchId: match.id,
    chainMatchId: match.smart_contract_match_id,
    stakeAmount: match.stake_amount,
    disputedAt: match.updated_at,
    players: [match.player_a_id, match.player_b_id].map((id) => ({
      userId: id,
      username: userById.get(id)?.username ?? null,
      wallet: userById.get(id)?.wallet_address ?? null,
    })),
  })),
}, null, 2));
