import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("live pilot notices identify providers, retention, and simulated dashboard data", () => {
  const privacy = readFileSync("app/privacy/page.tsx", "utf8");
  const dashboard = readFileSync("app/dashboard/page.tsx", "utf8");
  const enrollRoute = readFileSync("app/api/pilot/enroll/route.ts", "utf8");
  assert.match(privacy, /Privy.*Supabase.*Vercel.*Arc/s);
  assert.match(privacy, /up to 12 months/);
  assert.match(enrollRoute, /2026-09-01/);
  assert.match(dashboard, /Simulated combat log/);
  assert.doesNotMatch(dashboard, /\+8\.40 USDC|-5\.00 USDC|\+12\.00 USDC/);
});
