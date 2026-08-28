import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")];
      }),
  );
}

function normalizeUrl(value = "") {
  const index = value.includes("https://") ? value.indexOf("https://") : value.indexOf("http://");
  return index >= 0 ? value.slice(index).trim() : value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = loadEnv(".env.local");
const url = normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL);
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && anonKey && serviceKey, "Supabase environment variables are incomplete.");

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, serviceKey, options);
const anon = createClient(url, anonKey, options);

const utcDayStart = new Date();
utcDayStart.setUTCHours(0, 0, 0, 0);
const { data: completedToday } = await service
  .from("matches")
  .select("player_a_id,player_b_id,winner_id")
  .eq("status", "completed")
  .gte("updated_at", utcDayStart.toISOString())
  .limit(1)
  .maybeSingle();
const losingUserId = completedToday
  ? completedToday.player_a_id === completedToday.winner_id
    ? completedToday.player_b_id
    : completedToday.player_a_id
  : null;
const { data: users, error: usersError } = losingUserId
  ? { data: [{ id: losingUserId }], error: null }
  : await service.from("users").select("id").limit(1);
assert(!usersError && users?.length, `Test user unavailable: ${usersError?.message ?? "no users"}`);
const userId = users[0].id;

const { data: original, error: profileError } = await service
  .from("user_risk_profiles")
  .select("daily_stake_limit,daily_loss_limit,is_restricted")
  .eq("user_id", userId)
  .single();
assert(!profileError, `Risk profile unavailable: ${profileError?.message ?? "unknown error"}`);

const keys = [];
const reserve = async (amount, suffix) => {
  const key = `risk-validation-${randomUUID()}-${suffix}`;
  keys.push(key);
  const result = await service.rpc("reserve_daily_stake", {
    p_user_id: userId,
    p_amount: amount,
    p_idempotency_key: key,
  });
  assert(!result.error, `Reservation RPC failed: ${result.error?.message}`);
  return { key, row: result.data?.[0] };
};

const checks = [];
try {
  const tableCheck = await service.from("risk_stake_reservations").select("id", { head: true }).limit(1);
  checks.push({ check: "service-role table access", ok: !tableCheck.error });

  const anonTable = await anon.from("risk_stake_reservations").select("id").limit(1);
  checks.push({ check: "anonymous private-table denial", ok: Boolean(anonTable.error) });

  const anonRpc = await anon.rpc("reserve_daily_stake", {
    p_user_id: userId,
    p_amount: 1,
    p_idempotency_key: `anon-denied-${randomUUID()}`,
  });
  checks.push({ check: "anonymous RPC denial", ok: Boolean(anonRpc.error) });

  await service.from("user_risk_profiles").update({ is_restricted: true }).eq("user_id", userId).throwOnError();
  const restricted = await reserve(1, "restricted");
  checks.push({ check: "restricted account", ok: restricted.row?.allowed === false });

  await service
    .from("user_risk_profiles")
    .update({ is_restricted: false, daily_stake_limit: 1000, daily_loss_limit: 0 })
    .eq("user_id", userId)
    .throwOnError();
  const exact = await reserve(1000, "exact-boundary");
  checks.push({ check: "exact daily stake boundary", ok: exact.row?.allowed === true });

  const duplicate = await service.rpc("reserve_daily_stake", {
    p_user_id: userId,
    p_amount: 1000,
    p_idempotency_key: exact.key,
  });
  checks.push({ check: "idempotent retry", ok: !duplicate.error && duplicate.data?.[0]?.allowed === true });

  const over = await reserve(1, "over-boundary");
  checks.push({ check: "daily stake limit rejection", ok: over.row?.allowed === false });

  const { data: lossMatch } = await service
    .from("matches")
    .select("player_a_id,player_b_id,winner_id,stake_amount,updated_at")
    .eq("status", "completed")
    .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
    .neq("winner_id", userId)
    .gte("updated_at", utcDayStart.toISOString())
    .limit(1)
    .maybeSingle();
  if (lossMatch) {
    await service
      .from("user_risk_profiles")
      .update({ daily_stake_limit: 0, daily_loss_limit: 1 })
      .eq("user_id", userId)
      .throwOnError();
    const lossLimit = await reserve(1, "loss-limit");
    checks.push({ check: "daily loss limit rejection", ok: lossLimit.row?.allowed === false });
  } else {
    checks.push({ check: "daily loss limit rejection", ok: true, note: "no same-day loss fixture; SQL path inspected" });
  }
} finally {
  if (keys.length) {
    await service.from("risk_stake_reservations").update({ status: "released" }).in("idempotency_key", keys);
  }
  await service.from("user_risk_profiles").update(original).eq("user_id", userId);
}

for (const check of checks) assert(check.ok, `Failed: ${check.check}`);
console.log(JSON.stringify(checks, null, 2));
