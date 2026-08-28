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
const deployment = JSON.parse(readFileSync(resolve(scriptDirectory, "../deployments/arc-testnet.json"), "utf8"));
const { ethers } = await network.create();

function operatorKey() {
  const raw = process.env.OPERATOR_PRIVATE_KEY?.trim();
  const key = raw?.startsWith("0x") ? raw : raw ? `0x${raw}` : "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Valid OPERATOR_PRIVATE_KEY is required");
  return key;
}

async function sent(label: string, promise: Promise<any>, transactions: Record<string, string>) {
  const tx = await promise;
  transactions[label] = tx.hash;
  const receipt = await tx.wait();
  if (receipt?.status !== 1) throw new Error(`${label} reverted`);
}

async function expectRevert(promise: Promise<any>) {
  try { const tx = await promise; await tx.wait(); return false; } catch { return true; }
}

async function main() {
  if ((await ethers.provider.getNetwork()).chainId !== CHAIN_ID) throw new Error("Wrong chain");
  const [adminArbiter] = await ethers.getSigners();
  const operator = new ethers.Wallet(operatorKey(), ethers.provider);
  const player2 = ethers.Wallet.createRandom().connect(ethers.provider);
  const escrow = await ethers.getContractAt("SkillFiEscrowV2", deployment.escrow, operator);
  const escrowPlayer2 = escrow.connect(player2);
  const escrowArbiter = escrow.connect(adminArbiter);
  const tokenAbi = ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"];
  const token1 = new ethers.Contract(USDC, tokenAbi, operator);
  const token2 = new ethers.Contract(USDC, tokenAbi, player2);
  const transactions: Record<string, string> = {};

  for (const [name, wallet] of [["operator", operator], ["player2", player2]] as const) {
    const current = await ethers.provider.getBalance(wallet.address);
    if (current < TARGET_NATIVE) await sent(`fund-${name}`, adminArbiter.sendTransaction({ to: wallet.address, value: TARGET_NATIVE - current, ...FEES }), transactions);
  }

  async function createAndDeposit(prefix: string) {
    const id = BigInt(`0x${crypto.randomUUID().replaceAll("-", "")}`);
    await sent(`${prefix}-create`, escrow.createMatch(id, ENTRY, FEES), transactions);
    await sent(`${prefix}-approve-p1`, token1.approve(deployment.escrow, ENTRY, FEES), transactions);
    await sent(`${prefix}-join-p1`, escrow.joinMatch(id, { gasLimit: 250_000n, ...FEES }), transactions);
    await sent(`${prefix}-approve-p2`, token2.approve(deployment.escrow, ENTRY, FEES), transactions);
    await sent(`${prefix}-join-p2`, escrowPlayer2.joinMatch(id, { gasLimit: 250_000n, ...FEES }), transactions);
    return id;
  }

  const cancelId = await createAndDeposit("cancel");
  await sent("cancel-execute", escrow.cancelMatch(cancelId, { gasLimit: 300_000n, ...FEES }), transactions);
  const [cancelMatch, balanceAfterCancel] = await Promise.all([escrow.matches(cancelId), token1.balanceOf(deployment.escrow)]);
  const duplicateCancelRejected = await expectRevert(escrow.cancelMatch(cancelId, { gasLimit: 300_000n, ...FEES }));

  const disputeId = await createAndDeposit("dispute");
  await sent("dispute-start", escrow.startMatch(disputeId, { gasLimit: 180_000n, ...FEES }), transactions);
  await sent("dispute-open", escrowPlayer2.disputeMatch(disputeId, { gasLimit: 180_000n, ...FEES }), transactions);
  const disputedState = await escrow.matches(disputeId);
  await sent("dispute-resolve", escrowArbiter.resolveDispute(disputeId, player2.address, { gasLimit: 300_000n, ...FEES }), transactions);
  const [resolvedDispute, balanceAfterDispute] = await Promise.all([escrow.matches(disputeId), token1.balanceOf(deployment.escrow)]);
  const duplicateArbitrationRejected = await expectRevert(escrowArbiter.resolveDispute(disputeId, player2.address, { gasLimit: 300_000n, ...FEES }));

  const checks = {
    cancelTerminalState: cancelMatch.status === 6n,
    cancelEscrowEmpty: balanceAfterCancel === 0n,
    duplicateCancelRejected,
    disputeStateObserved: disputedState.status === 5n,
    disputeResolved: resolvedDispute.status === 4n,
    disputeWinnerIsParticipant: resolvedDispute.player2.toLowerCase() === player2.address.toLowerCase(),
    disputeEscrowEmpty: balanceAfterDispute === 0n,
    duplicateArbitrationRejected,
  };
  console.log(JSON.stringify({ network: "Arc Testnet", chainId: Number(CHAIN_ID), escrow: deployment.escrow, cancelMatchId: cancelId.toString(), disputeMatchId: disputeId.toString(), player1: operator.address, player2: player2.address, transactions, checks, completedAt: new Date().toISOString() }, null, 2));
  if (Object.values(checks).some((value) => value !== true)) process.exitCode = 1;
}

await main();
