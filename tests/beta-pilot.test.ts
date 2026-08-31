import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("beta pilot requires explicit adult, terms, and privacy consent", () => {
  const route = readFileSync("app/api/pilot/enroll/route.ts", "utf8");
  assert.match(route, /adultAttested/);
  assert.match(route, /termsAccepted/);
  assert.match(route, /privacyAccepted/);
  assert.match(route, /status: 400/);
});

test("beta activation enforces the 100-player cap atomically", () => {
  const migration = readFileSync("supabase/11_beta_pilot.sql", "utf8");
  assert.match(migration, /activate_beta_participant/);
  assert.match(migration, /count\(\*\).*status = 'active'[\s\S]*>= 100/);
  assert.match(migration, /where id = p_enrollment_id and status = 'applied'/);
});

test("pilot copy keeps real-value activity disabled", () => {
  const client = readFileSync("components/PilotEnrollmentClient.tsx", "utf8");
  assert.match(client, /no real deposits, prizes, lending, or production-value transfers/i);
});

test("pilot admin UI exposes only controlled cohort transitions", () => {
  const client = readFileSync("components/PilotAdminClient.tsx", "utf8");
  assert.match(client, /"active" \| "rejected" \| "completed"/);
  assert.doesNotMatch(client, /delete|payment|prize/i);
});

test("pilot game entry is gated before onchain create or join", () => {
  const createRoute = readFileSync("app/api/matches/create/route.ts", "utf8");
  const joinCheck = readFileSync("app/api/matches/join/check/route.ts", "utf8");
  const joinConfirm = readFileSync("app/api/matches/join/route.ts", "utf8");
  const challengeAccept = readFileSync("app/api/challenges/[id]/accept/route.ts", "utf8");
  for (const source of [createRoute, joinCheck, joinConfirm, challengeAccept]) assert.match(source, /hasActiveBetaAccess/);
  assert.ok(createRoute.lastIndexOf("hasActiveBetaAccess") < createRoute.indexOf("writeContract"));
  assert.ok(challengeAccept.lastIndexOf("hasActiveBetaAccess") < challengeAccept.indexOf('.rpc("accept_challenge"'));
  assert.match(joinCheck, /status: 403/);
});

test("challenge UI explains beta access and avoids financial reward claims", () => {
  const hub = readFileSync("components/ChallengeHubClient.tsx", "utf8");
  const enrollment = readFileSync("components/PilotEnrollmentClient.tsx", "utf8");
  assert.match(hub, /Beta access active/);
  assert.match(hub, /Pilot arena locked/);
  assert.match(enrollment, /ENTER CHALLENGE ARENA/);
  assert.doesNotMatch(hub, /REWARD POOL|180 USDC|Verified entry fees/);
  const card = readFileSync("components/ChallengeCard.tsx", "utf8");
  assert.match(card, /canJoin/);
  assert.match(card, /BETA ACCESS/);
});
