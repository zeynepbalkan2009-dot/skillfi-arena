import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("public open-match endpoints use explicit safe projections", () => {
  for (const path of ["app/api/matches/open/route.ts", "app/challenges/page.tsx"]) {
    const text = source(path);
    assert.doesNotMatch(text, /\.select\(\s*["'`]\*["'`]\s*\)/);
    assert.doesNotMatch(text, /game:games\(\*\)/);
    assert.doesNotMatch(text, /created_by_user_id/);
    assert.doesNotMatch(text, /studio_id/);
    assert.match(text, /player_a:users!matches_player_a_id_fkey/);
    assert.match(text, /id,\s*username,\s*display_name,\s*avatar_url,\s*region/s);
  }
});

test("public game catalog does not expose internal studio or creator linkage", () => {
  const text = source("app/games/page.tsx");
  assert.doesNotMatch(text, /\.select\(\s*["'`]\*["'`]\s*\)/);
  assert.doesNotMatch(text, /created_by_user_id/);
  assert.doesNotMatch(text, /studio_id/);
  assert.match(text, /PUBLIC_GAME_SELECT/);
  assert.match(text, /integration_status["']?,\s*["']published["']/);
});

test("lobby refreshes through projected server APIs and does not subscribe to public database changes", () => {
  const text = source("components/LobbyClient.tsx");
  assert.match(text, /fetch\(["']\/api\/matches\/open["']/);
  assert.match(text, /window\.setInterval/);
  assert.doesNotMatch(text, /postgres_changes/);
  assert.doesNotMatch(text, /\.from\(["']users["']\)/);
  assert.doesNotMatch(text, /wallet_address/);
});

test("invite-token and accepted-challenge payloads exclude wallets and wildcard relations", () => {
  for (const path of ["app/challenge/[token]/page.tsx", "app/api/challenges/[id]/accept/route.ts"]) {
    const text = source(path);
    assert.doesNotMatch(text, /wallet_address/);
    assert.doesNotMatch(text, /games\(\*\)/);
    assert.doesNotMatch(text, /\.select\(\s*["'`]\*["'`]\s*\)/);
    assert.doesNotMatch(text, /created_by_user_id/);
    assert.doesNotMatch(text, /studio_id/);
  }
});

test("public match detail excludes private player wallet fields", () => {
  const text = source("app/matches/[id]/page.tsx");
  assert.doesNotMatch(text, /wallet_address/);
  assert.doesNotMatch(text, /games\(\*\)/);
  assert.match(text, /PUBLIC_MATCH_DETAIL_SELECT/);
});

test("live match identity uses Privy profile ids and projected polling without public realtime", () => {
  const page = source("app/match/[id]/page.tsx");
  const client = source("components/LiveMatchClient.tsx");
  assert.doesNotMatch(page, /wallet_address/);
  assert.doesNotMatch(client, /wallet_address/);
  assert.doesNotMatch(client, /useAccount/);
  assert.doesNotMatch(client, /postgres_changes/);
  assert.doesNotMatch(client, /\.channel\(/);
  assert.match(client, /useSkillFiUser/);
  assert.match(client, /profile\.id === match\.player_a_id/);
  assert.match(client, /profile\.id === match\.player_b_id/);
  assert.match(client, /status,winner_id,started_at,player_a_id,player_b_id,updated_at/);
});

test("schema 19 closes direct challenge and participant graph enumeration", () => {
  const migration = source("supabase/19_public_match_graph_privacy.sql");
  assert.match(migration, /revoke all on public\.challenges from anon, authenticated/);
  assert.match(migration, /revoke all on public\.challenge_participants from anon, authenticated/);
  assert.match(migration, /revoke all on public\.match_participants from anon, authenticated/);
  assert.match(migration, /drop policy if exists "challenges_public_read"/);
  assert.match(migration, /grant select \([\s\S]*smart_contract_match_id[\s\S]*started_at[\s\S]*\) on public\.matches to anon, authenticated/);
  assert.doesNotMatch(migration, /grant select[\s\S]*challenge_id[\s\S]*on public\.matches/);
  assert.match(migration, /set version = 19/);
});

test("schema 20 removes matches from the realtime publication", () => {
  const migration = source("supabase/20_disable_public_match_realtime.sql");
  const health = source("app/api/health/route.ts");
  assert.match(migration, /alter publication supabase_realtime drop table public\.matches/);
  assert.match(migration, /set version = 20/);
  assert.match(health, /EXPECTED_SCHEMA_VERSION = 20/);
});
