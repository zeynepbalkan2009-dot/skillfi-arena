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

test("schema 21 revokes legacy integration credentials before scrypt-only authentication", () => {
  const migration = source("supabase/21_rotate_game_api_key_hashes.sql");
  const health = source("app/api/health/route.ts");
  assert.match(migration, /update public\.game_api_credentials[\s\S]*set revoked_at = coalesce\(revoked_at, now\(\)\)/);
  assert.match(migration, /game_api_credentials_key_prefix_unique/);
  assert.match(migration, /\[0-9a-f\]\{12\}/);
  assert.match(migration, /set version = 21/);
  assert.match(health, /EXPECTED_SCHEMA_VERSION = 21/);
});
