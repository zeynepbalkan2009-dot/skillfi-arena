import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("pilot consent links to the exact versioned notices stored by enrollment", () => {
  const client = readFileSync("components/PilotEnrollmentClient.tsx", "utf8");
  const route = readFileSync("app/api/pilot/enroll/route.ts", "utf8");
  const policy = readFileSync("lib/pilotPolicy.ts", "utf8");
  const terms = readFileSync("app/terms/page.tsx", "utf8");
  assert.match(client, /href="\/terms"/);
  assert.match(client, /href="\/privacy"/);
  assert.match(client, /PILOT_TERMS_VERSION/);
  assert.match(client, /PILOT_PRIVACY_VERSION/);
  assert.match(route, /PILOT_TERMS_VERSION/);
  assert.match(route, /PILOT_PRIVACY_VERSION/);
  assert.match(policy, /2026-08-31/);
  assert.match(policy, /2026-09-01/);
  assert.match(terms, /31 August 2026/);
});
