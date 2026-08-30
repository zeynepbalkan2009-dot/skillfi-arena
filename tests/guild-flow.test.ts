import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeGuildSlug, validateGuildInput } from "../lib/guilds.ts";

test("guild names produce safe stable slugs", () => {
  assert.equal(normalizeGuildSlug("  Neon Şövalyeler DAO  "), "neon-sovalyeler-dao");
  assert.equal(validateGuildInput({ name: "Arc Vanguard" }).slug, "arc-vanguard");
  assert.throws(() => validateGuildInput({ name: "x" }), /3-48/);
});

test("guild schema enforces one guild per player and immutable treasury history", () => {
  const migration = readFileSync("supabase/09_guild_dao.sql", "utf8");
  assert.match(migration, /guild_members_one_guild_per_user[\s\S]*\(user_id\)/);
  assert.match(migration, /guild_treasury_events_immutable[\s\S]*before update or delete/);
  assert.match(migration, /create_guild_with_owner/);
});

test("guild UI keeps treasury execution disabled", () => {
  const client = readFileSync("components/GuildsClient.tsx", "utf8");
  assert.match(client, /cannot transfer funds yet/);
  assert.doesNotMatch(client, /writeContract|sendTransaction/);
});
