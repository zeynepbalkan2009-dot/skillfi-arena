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

test("realtime lobby resolves creator through the public profile projection and selects safe match columns", () => {
  const text = source("components/LobbyClient.tsx");
  assert.match(text, /\.from\(["']public_profiles["']\)/);
  assert.match(text, /\.select\(["']id,username,display_name,avatar_url,region["']\)/);
  assert.doesNotMatch(text, /\.from\(["']users["']\)[\s\S]{0,180}wallet_address/);
  assert.match(text, /const REALTIME_MATCH_COLUMNS/);
  assert.match(text, /select: REALTIME_MATCH_COLUMNS/);
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

test("live match identity uses Privy profile ids and does not serialize wallets", () => {
  const page = source("app/match/[id]/page.tsx");
  const client = source("components/LiveMatchClient.tsx");
  assert.doesNotMatch(page, /wallet_address/);
  assert.doesNotMatch(client, /wallet_address/);
  assert.doesNotMatch(client, /useAccount/);
  assert.match(client, /useSkillFiUser/);
  assert.match(client, /profile\.id === match\.player_a_id/);
  assert.match(client, /profile\.id === match\.player_b_id/);
  assert.match(client, /select: REALTIME_MATCH_COLUMNS/);
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
