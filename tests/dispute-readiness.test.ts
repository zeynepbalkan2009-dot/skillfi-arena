import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(join(process.cwd(), "scripts/dispute-readiness.mjs"), "utf8");
const grantSource = readFileSync(join(process.cwd(), "web3/scripts/configure-arc-arbiter.ts"), "utf8");

test("dispute readiness is read-only and redacts the arbiter wallet", () => {
  assert.match(source, /getCode/);
  assert.match(source, /hasRole/);
  assert.match(source, /arbiter\.address\.slice/);
  assert.match(source, /participant-dispute-required/);
  assert.match(source, /ARBITER_PRIVATE_KEY \|\| env\.OPERATOR_PRIVATE_KEY/);
  assert.match(source, /roles: \{ arbiter: hasArbiterRole, operator: hasOperatorRole, admin: hasAdminRole \}/);
  assert.match(source, /if \(!hasArbiterRole\) process\.exitCode = 1/);
  assert.doesNotMatch(source, /writeContract|console\.log\([^)]*rawArbiterKey/);
});

test("Arc arbiter grant requires an admin signer and verifies the confirmed role", () => {
  assert.match(grantSource, /DEFAULT_ADMIN_ROLE/);
  assert.match(grantSource, /ARC_APP_ARBITER_ADDRESS/);
  assert.match(grantSource, /receipt\.status !== 1/);
  assert.match(grantSource, /hasRole\(arbiterRole, arbiterAddress\)/);
});
