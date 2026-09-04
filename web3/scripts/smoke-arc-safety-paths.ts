import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { network } from "hardhat";

const CHAIN_ID = 5_042_002n;
const USDC = "0x3600000000000000000000000000000000000000";
const ENTRY = 500_000n;
const TARGET_NATIVE = 4n * 10n ** 18n;
const FEES = { maxFeePerGas: 20n * 10n ** 9n, maxPriorityFeePerGas: 1n * 10n ** 9n };
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(scriptDirectory, "../../.env.local"), quiet: true });
const deployment = JSON.parse(readFileSync(resolve(scriptDirectory, "../deployments/arc-testnet-v3.json"), "utf8"));
const { ethers } = await network.create();

function privateKey(name: string) {
  const raw = process.env[name]?.trim();
  const key = raw?.startsWith("0x") ? raw : raw ? `0x${raw}` : "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error(`Valid ${name} is required`);
  return key;
}

async function sent(label: string, promise: Promise<any>, transactions: Record<string, string>) {
  const tx = await promise;
  transactions[label] = tx.hash;
  const receipt = await tx.wait();
  if (receipt?.status !== 1) throw new Error(`${label} reverted`);
}

async function expectRevert(promise: Promise<any>) {
  try {
    const tx = await promise;
    await tx.wait();
    return false;
  } catch {
    return true;
  }
}

async function main() {
  if ((await ethers.provider.getNetwork()).chainId !== CHAIN_ID) throw new Error("Wrong chain");
  if (deployment.contract !== "SkillFiEscrowV3") throw new Error("Safety smoke requires SkillFiEscrowV3");
  if (String(deployment.usdc).toLowerCase() !== USDC.toLowerCase()) throw new Error("Deployment does not use canonical Arc USDC");

  const [funder] = await ethers.getSigners();
  const operator = new ethers.Wallet(privateKey("OPERATOR_PRIVATE_KEY"), ethers.provider);
  const arbiter = new ethers.Wallet(privateKey("ARC_ARBITER_PRIVATE_KEY"), ethers.provider);
  if (operator.address.toLowerCase() !== String(deployment.operator).toLowerCase()) {
    throw new Error("OPERATOR_PRIVATE_KEY does not match deployment.operator");
  }
  if (arbiter.address.toLowerCase() !== String(deployment.arbiter).toLowerCase()) {
    throw new Error("ARC_ARBITER_PRIVATE_KEY does not match deployment.arbiter");
  }

  const player1 = ethers.Wallet.createRandom().connect(ethers.provider);
  const player2 = ethers.Wallet.createRandom().connect(ethers.provider);
  const escrowOperator = await ethers.getContractAt("SkillFiEscrowV3", deployment.escrow, operator);
  const escrowPlayer1 = escrowOperator.connect(player1) as typeof escrowOperator;
  const escrowPlayer2 = escrowOperator.connect(player2) as typeof escrowOperator;
  const escrowArbiter = escrowOperator.connect(arbiter) as typeof escrowOperator;
  const tokenAbi = ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"];
  const token1 = new ethers.Contract(USDC, tokenAbi, player1);
  const token2 = new ethers.Contract(USDC, tokenAbi, player2);
  const tokenRead = new ethers.Contract(USDC, tokenAbi, ethers.provider);
  const transactions: Record<string, string> = {};

  const operatorRole = await escrowOperator.OPERATOR_ROLE();
  const arbiterRole = await escrowOperator.ARBITER_ROLE();
  if (!(await escrowOperator.hasRole(operatorRole, operator.address))) throw new Error("Configured operator lacks OPERATOR_ROLE");
  if (!(await escrowOperator.hasRole(arbiterRole, arbiter.address))) throw new Error("Configured arbiter lacks ARBITER_ROLE");

  for (const [name, wallet] of [
    ["operator", operator],
    ["arbiter", arbiter],
    ["player1", player1],
    ["player2", player2],
  ] as const) {
    const current = await ethers.provider.getBalance(wallet.address);
    if (current < TARGET_NATIVE) {
      await sent(`fund-${name}`, funder.sendTransaction({ to: wallet.address, value: TARGET_NATIVE - current, ...FEES }), transactions);
    }
  }

  if ((await tokenRead.balanceOf(player1.address)) < ENTRY || (await tokenRead.balanceOf(player2.address)) < ENTRY) {
    throw new Error("Player funding did not surface through canonical Arc USDC");
  }

  async function createAndDeposit(prefix: string) {
    const id = BigInt(`0x${crypto.randomUUID().replaceAll("-", "")}`);
    await sent(`${prefix}-create`, escrowOperator.createMatch(id, ENTRY, player1.address, FEES), transactions);
    await sent(`${prefix}-approve-p1`, token1.approve(deployment.escrow, ENTRY, FEES), transactions);
    await sent(`${prefix}-join-p1`, escrowPlayer1.joinMatch(id, { gasLimit: 250_000n, ...FEES }), transactions);
    await sent(`${prefix}-approve-p2`, token2.approve(deployment.escrow, ENTRY, FEES), transactions);
    await sent(`${prefix}-join-p2`, escrowPlayer2.joinMatch(id, { gasLimit: 250_000n, ...FEES }), transactions);
    return id;
  }

  const cancelId = await createAndDeposit("cancel");
  await sent("cancel-execute", escrowOperator.cancelMatch(cancelId, { gasLimit: 300_000n, ...FEES }), transactions);
  const [cancelMatch, balanceAfterCancel] = await Promise.all([
    escrowOperator.matches(cancelId),
    tokenRead.balanceOf(deployment.escrow),
  ]);
  const duplicateCancelRejected = await expectRevert(
    escrowOperator.cancelMatch(cancelId, { gasLimit: 300_000n, ...FEES }),
  );

  const disputeId = await createAndDeposit("dispute");
  await sent("dispute-start", escrowOperator.startMatch(disputeId, { gasLimit: 180_000n, ...FEES }), transactions);
  await sent("dispute-open", escrowPlayer2.disputeMatch(disputeId, { gasLimit: 180_000n, ...FEES }), transactions);
  const disputedState = await escrowOperator.matches(disputeId);
  await sent(
    "dispute-resolve",
    escrowArbiter.resolveDispute(disputeId, player2.address, { gasLimit: 300_000n, ...FEES }),
    transactions,
  );
  const [resolvedDispute, balanceAfterDispute] = await Promise.all([
    escrowOperator.matches(disputeId),
    tokenRead.balanceOf(deployment.escrow),
  ]);
  const duplicateArbitrationRejected = await expectRevert(
    escrowArbiter.resolveDispute(disputeId, player2.address, { gasLimit: 300_000n, ...FEES }),
  );

  const checks = {
    cancelTerminalState: cancelMatch.status === 6n,
    cancelEscrowEmpty: balanceAfterCancel === 0n,
    cancelCreatorBound: cancelMatch.player1.toLowerCase() === player1.address.toLowerCase(),
    duplicateCancelRejected,
    disputeStateObserved: disputedState.status === 5n,
    disputeTimestampStored: disputedState.disputedAt > 0n,
    disputeResolved: resolvedDispute.status === 4n,
    disputeWinnerStored: resolvedDispute.winner.toLowerCase() === player2.address.toLowerCase(),
    disputeEscrowEmpty: balanceAfterDispute === 0n,
    duplicateArbitrationRejected,
  };
  console.log(JSON.stringify({
    network: "Arc Testnet",
    chainId: Number(CHAIN_ID),
    contract: deployment.contract,
    escrow: deployment.escrow,
    cancelMatchId: cancelId.toString(),
    disputeMatchId: disputeId.toString(),
    operator: operator.address,
    arbiter: arbiter.address,
    player1: player1.address,
    player2: player2.address,
    transactions,
    checks,
    completedAt: new Date().toISOString(),
  }, null, 2));
  if (Object.values(checks).some((value) => value !== true)) process.exitCode = 1;
}

await main();
