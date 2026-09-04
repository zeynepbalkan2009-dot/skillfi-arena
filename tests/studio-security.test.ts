import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("studio website URLs allow only http and https", () => {
  const studios = source("lib/studios.ts");
  assert.match(studios, /new URL\(value\.trim\(\)\)/);
  assert.match(studios, /\[\s*['"]http:['"]\s*,\s*['"]https:['"]\s*\]\.includes\(url\.protocol\)/);
  assert.match(studios, /Website must use http or https/);
  assert.doesNotMatch(studios, /javascript:/i);
});

test("authenticated studio game draft responses are explicitly non-cacheable", () => {
  const route = source("app/api/studios/games/route.ts");
  assert.match(route, /Cache-Control": "private, no-store, max-age=0/);
  assert.match(route, /function studioJson/);
  assert.match(route, /return studioJson\(\{ game: data \}, 201\)/);
  assert.match(route, /return studioJson\(\{ game \}\)/);
});

test("game integration credentials use random hex prefixes and scrypt hashes", () => {
  const credentials = source("lib/gameCredentials.ts");
  assert.match(credentials, /randomBytes\(6\)\.toString\("hex"\)/);
  assert.match(credentials, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(credentials, /scryptSync\(/);
  assert.match(credentials, /N:\s*16_384/);
  assert.match(credentials, /timingSafeEqual\(expected, candidate\)/);
  assert.match(credentials, /\.eq\("key_prefix", prefix\)/);
  assert.doesNotMatch(credentials, /createHash\("sha256"\)\.update\(secret/);
});

test("credential rotation is staged before legacy keys are revoked", () => {
  const prepare = source("supabase/21_rotate_game_api_key_hashes.sql");
  const cutover = source("supabase/22_revoke_legacy_game_api_keys.sql");
  const health = source("app/api/health/route.ts");

  assert.match(prepare, /NON-DESTRUCTIVE/);
  assert.match(prepare, /game_api_credentials_key_prefix_unique/);
  assert.match(prepare, /\[0-9a-f\]\{12\}/);
  assert.match(prepare, /set version = 21/);
  assert.doesNotMatch(prepare, /set revoked_at\s*=\s*(?:coalesce\()?/);

  assert.match(cutover, /set revoked_at = now\(\)/);
  assert.match(cutover, /\[a-zA-Z0-9\]\{8\}/);
  assert.match(cutover, /active legacy game API credentials remain after schema 22 cutover/);
  assert.match(cutover, /set version = 22/);
  assert.doesNotMatch(cutover, /\[0-9a-f\]\{12\}.*revoked_at/s);
  assert.match(health, /EXPECTED_SCHEMA_VERSION = 22/);
});
