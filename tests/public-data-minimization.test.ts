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

test("realtime lobby resolves creator through the public profile projection", () => {
  const text = source("components/LobbyClient.tsx");
  assert.match(text, /\.from\(["']public_profiles["']\)/);
  assert.match(text, /\.select\(["']id,username,display_name,avatar_url,region["']\)/);
  assert.doesNotMatch(text, /\.from\(["']users["']\)[\s\S]{0,180}wallet_address/);
});
