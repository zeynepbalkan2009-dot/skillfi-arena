import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("v3 deploys with deposits closed and only admin can activate new exposure", () => {
  const contract = source("web3/contracts/SkillFiEscrowV3.sol");
  assert.match(contract, /bool public depositsEnabled/);
  assert.match(contract, /depositsEnabled = false/);
  assert.match(contract, /modifier whenDepositsEnabled\(\)/);
  assert.match(contract, /require\(depositsEnabled, "deposits disabled"\)/);
  assert.match(contract, /function createMatch[\s\S]*?whenNotPaused[\s\S]*?whenDepositsEnabled/);
  assert.match(contract, /function joinMatch[^\n]*whenNotPaused whenDepositsEnabled/);
  assert.match(contract, /function setDepositsEnabled\(bool _enabled\) external onlyRole\(DEFAULT_ADMIN_ROLE\)/);

  const startBlock = contract.match(/function startMatch[\s\S]*?\n    }\n/)?.[0] ?? "";
  const resolveBlock = contract.match(/function resolveMatch[\s\S]*?\n    }\n/)?.[0] ?? "";
  assert.ok(startBlock.length > 0 && resolveBlock.length > 0);
  assert.doesNotMatch(startBlock, /whenDepositsEnabled/);
  assert.doesNotMatch(resolveBlock, /whenDepositsEnabled/);
});

test("release health requires application and onchain exposure gates to agree", () => {
  const health = source("app/api/health/route.ts");
  assert.match(health, /functionName: "depositsEnabled"/);
  assert.match(health, /onchainDepositsEnabled !== null && onchainDepositsEnabled === valueBearingEnabled/);
  assert.match(health, /&& valueBearingAligned/);
  assert.match(health, /applicationEnabled: valueBearingEnabled/);
  assert.match(health, /onchainDepositsEnabled/);
  assert.match(health, /aligned: valueBearingAligned/);
});

test("arc deployment and validator fail closed on deposit activation state", () => {
  const deploy = source("web3/scripts/deploy-arc.ts");
  const validate = source("web3/scripts/validate-arc-deployment.mjs");
  assert.match(deploy, /depositsEnabledAtDeployment: false/);
  assert.match(deploy, /V3 deposits must be disabled at deployment/);
  assert.match(validate, /ARC_EXPECT_DEPOSITS_ENABLED/);
  assert.match(validate, /depositsWereClosedAtDeployment/);
  assert.match(validate, /depositsMatchExplicitExpectation/);
});

test("admin activation tooling emits calldata without signing or broadcasting", () => {
  const encoder = source("web3/scripts/encode-arc-admin-action.mjs");
  const web3Package = source("web3/package.json");
  assert.match(encoder, /enable-deposits/);
  assert.match(encoder, /disable-deposits/);
  assert.match(encoder, /setDepositsEnabled/);
  assert.match(encoder, /encodeFunctionData/);
  assert.match(encoder, /signsOrBroadcastsTransaction: false/);
  assert.doesNotMatch(encoder, /PRIVATE_KEY|Wallet\(|sendTransaction|broadcastTransaction/);
  assert.match(web3Package, /"admin:calldata": "node scripts\/encode-arc-admin-action\.mjs"/);
});
