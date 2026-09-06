import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(join(process.cwd(), "app/api/admin/disputes/readiness/route.ts"), "utf8");

test("admin dispute readiness is authenticated, read-only, and redacts signer details", () => {
  assert.match(source, /isStudioAdmin/);
  assert.match(source, /status: 403/);
  assert.match(source, /functionName: "hasRole"/);
  assert.match(source, /signer\.slice\(0, 6\)/);
  assert.match(source, /pendingResolutionCount/);
  assert.doesNotMatch(source, /writeContract|grantRole|OPERATOR_PRIVATE_KEY/);
});
