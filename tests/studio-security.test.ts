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
