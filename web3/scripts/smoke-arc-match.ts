import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { network } from "hardhat";

const ARC_TESTNET_CHAIN_ID = 5_042_002n;
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";
const ENTRY_FEE = 1_000_000n; // 1 USDC through the 6-decimal ERC-20 interface
const PLAYER_NATIVE_TARGET = 3n * 10n ** 18n; // Native gas representation uses 18 decimals
const MAX_FEE_PER_GAS = 20n * 10n ** 9n;
const PRIORITY_FEE_PER_GAS = 1n * 10n ** 9n;

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(scriptDirectory, "../../.env.local"), quiet: true });
const deployment = JSON.parse(readFileSync(resolve(scriptDirectory, "../deployments/arc-testnet.json"), "utf8"));
const { ethers } = await network.create();

function appOperatorKey(): string {
  const raw = process.env.OPERATOR_PRIVATE_KEY?.trim();
  if (!raw) throw new Error("OPERATOR_PRIVATE_KEY is missing from the root .env.local");
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("OPERATOR_PRIVATE_KEY must be a 32-byte hex value");
  return key;
}

async function waitForReceipt(label: string, transactionPromise: Promise<any>, transactions: Record<string, string>) {
  const transaction = await transactionPromise;
  transactions[label] = transaction.hash;
  const receipt = await transaction.wait();
  if (receipt?.status !== 1) throw new Error(`${label} transaction reverted`);
}

async function main() {
  const networkInfo = await ethers.provider.getNetwork();
  if (networkInfo.chainId !== ARC_TESTNET_CHAIN_ID) throw new Error(`Expected Arc Testnet chain ID ${ARC_TESTNET_CHAIN_ID}`);
  if (deployment.usdc.toLowerCase() !== ARC_TESTNET_USDC.toLowerCase()) throw new Error("Deployment does not use canonical Arc USDC");

  const [funder] = await ethers.getSigners();
  const operator = new ethers.Wallet(appOperatorKey(), ethers.provider);
  const player2 = ethers.Wallet.createRandom().connect(ethers.provider);
  const escrow = await ethers.getContractAt("SkillFiEscrowV2", deployment.escrow, operator);
  const escrowPlayer2 = escrow.connect(player2);
  const usdcAbi = [
    "function approve(address spender,uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner,address spender) view returns (uint256)",
  ];
  const usdc = new ethers.Contract(ARC_TESTNET_USDC, usdcAbi, operator);
  const usdcPlayer2 = new ethers.Contract(ARC_TESTNET_USDC, usdcAbi, player2);
  const transactions: Record<string, string> = {};
  const feeOverrides = { maxFeePerGas: MAX_FEE_PER_GAS, maxPriorityFeePerGas: PRIORITY_FEE_PER_GAS };

  const operatorRole = await escrow.OPERATOR_ROLE();
  if (!(await escrow.hasRole(operatorRole, operator.address))) throw new Error(`Application operator ${operator.address} lacks OPERATOR_ROLE`);

  for (const [label, wallet] of [["operator", operator], ["player2", player2]] as const) {
    const balance = await ethers.provider.getBalance(wallet.address);
    if (balance < PLAYER_NATIVE_TARGET) {
      await waitForReceipt(`fund-${label}`, funder.sendTransaction({ to: wallet.address, value: PLAYER_NATIVE_TARGET - balance, ...feeOverrides }), transactions);
    }
  }

  const [operatorBalanceBefore, player2BalanceBefore] = await Promise.all([
    usdc.balanceOf(operator.address),
    usdc.balanceOf(player2.address),
  ]);
  if (operatorBalanceBefore < ENTRY_FEE || player2BalanceBefore < ENTRY_FEE) throw new Error("Native funding did not surface through the canonical USDC ERC-20 interface");

  const matchId = BigInt(`0x${crypto.randomUUID().replaceAll("-", "")}`);
  await waitForReceipt("createMatch", escrow.createMatch(matchId, ENTRY_FEE, feeOverrides), transactions);
  await waitForReceipt("approvePlayer1", usdc.approve(deployment.escrow, ENTRY_FEE, feeOverrides), transactions);
  await waitForReceipt("joinPlayer1", escrow.joinMatch(matchId, { gasLimit: 250_000n, ...feeOverrides }), transactions);
  await waitForReceipt("approvePlayer2", usdcPlayer2.approve(deployment.escrow, ENTRY_FEE, feeOverrides), transactions);
  await waitForReceipt("joinPlayer2", escrowPlayer2.joinMatch(matchId, { gasLimit: 250_000n, ...feeOverrides }), transactions);
  await waitForReceipt("startMatch", escrow.startMatch(matchId, { gasLimit: 180_000n, ...feeOverrides }), transactions);
  await waitForReceipt("resolveMatch", escrow.resolveMatch(matchId, operator.address, { gasLimit: 300_000n, ...feeOverrides }), transactions);

  const [match, escrowBalance, operatorBalanceAfter, player2BalanceAfter] = await Promise.all([
    escrow.matches(matchId),
    usdc.balanceOf(deployment.escrow),
    usdc.balanceOf(operator.address),
    usdc.balanceOf(player2.address),
  ]);
  const checks = {
    statusResolved: match.status === 4n,
    player1Matches: match.player1.toLowerCase() === operator.address.toLowerCase(),
    player2Matches: match.player2.toLowerCase() === player2.address.toLowerCase(),
    bothDeposited: match.player1Deposited && match.player2Deposited,
    canonicalUsdcEscrowEmpty: escrowBalance === 0n,
    winnerBalanceIncreased: operatorBalanceAfter > operatorBalanceBefore,
    loserPaidEntryFee: player2BalanceAfter < player2BalanceBefore,
  };
  const evidence = {
    network: "Arc Testnet",
    chainId: Number(ARC_TESTNET_CHAIN_ID),
    matchId: matchId.toString(),
    escrow: deployment.escrow,
    usdc: ARC_TESTNET_USDC,
    player1: operator.address,
    player2: player2.address,
    entryFeeUsdcBaseUnits: ENTRY_FEE.toString(),
    transactions,
    checks,
    completedAt: new Date().toISOString(),
  };
  console.log(JSON.stringify(evidence, null, 2));
  if (Object.values(checks).some((value) => value !== true)) process.exitCode = 1;
}

await main();
