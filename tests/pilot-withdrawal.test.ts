import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("participants can withdraw applied or active pilot access", () => {
  const route = readFileSync("app/api/pilot/enroll/route.ts", "utf8");
  const client = readFileSync("components/PilotEnrollmentClient.tsx", "utf8");
  assert.match(route, /action !== "withdraw"/);
  assert.match(route, /\.in\("status", \["applied", "active"\]\)/);
  assert.match(route, /withdrawn_at/);
  assert.match(client, /WITHDRAW FROM PILOT/);
  assert.match(client, /window\.confirm/);
});
