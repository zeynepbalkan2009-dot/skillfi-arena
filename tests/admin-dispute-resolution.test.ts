import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("admin dispute resolution requires explicit, participant-safe arbitration", () => {
  const route = readFileSync("app/api/admin/disputes/resolve/route.ts", "utf8");
  assert.match(route, /isStudioAdmin/);
  assert.match(route, /confirmation !== "RESOLVE_DISPUTE"/);
  assert.match(route, /Winner must be a match participant/);
  assert.match(route, /ARBITER_ROLE/);
  assert.match(route, /Database and on-chain participants do not match/);
  assert.match(route, /waitForTransactionReceipt/);
  assert.match(route, /findResolution/);
  assert.match(route, /dispute_resolution_broadcast/);
  assert.match(route, /dispute_resolved/);
});

test("admin UI forces a named winner confirmation", () => {
  const panel = readFileSync("components/DisputeResolutionPanel.tsx", "utf8");
  assert.match(panel, /window\.confirm/);
  assert.match(panel, /irreversible Arc Testnet transaction/);
  assert.match(panel, /confirmation: "RESOLVE_DISPUTE"/);
  assert.match(panel, /AWARD TO/);
});
