import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("pilot launch readiness is admin-only and fail-closed", () => {
  const route = readFileSync("app/api/admin/readiness/route.ts", "utf8");
  assert.match(route, /isStudioAdmin/);
  assert.match(route, /status: 403/);
  assert.match(route, /fiveGamesPublished/);
  assert.match(route, /cohortWithinCapacity/);
  assert.match(route, /escrowDeployed/);
  assert.match(route, /operatorReady/);
  assert.match(route, /arbiterReady/);
  assert.match(route, /Object\.values\(checks\)\.every\(Boolean\)/);
  assert.doesNotMatch(route, /PRIVATE_KEY|SERVICE_ROLE_KEY/);
});

test("pilot admin exposes a read-only readiness panel", () => {
  const page = readFileSync("app/pilot/admin/page.tsx", "utf8");
  const panel = readFileSync("components/PilotReadinessPanel.tsx", "utf8");
  assert.match(page, /PilotReadinessPanel/);
  assert.match(panel, /\/api\/admin\/readiness/);
  assert.match(panel, /READY FOR CONTROLLED TESTING/);
  assert.match(panel, /pending disputes/);
  assert.match(panel, /pendingStudioReviews/);
  assert.doesNotMatch(panel, /method:\s*["'](?:POST|PATCH|DELETE)/);
});
