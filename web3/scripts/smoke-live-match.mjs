import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { Contract, JsonRpcProvider, Wallet, parseUnits } from "ethers";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env.local"), quiet: true });

const deployment = JSON.parse(
  readFileSync(new URL("../deployments/base-sepolia-v3.json", import.meta.url), "utf8"),
);

const rpcUrl =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ||
  process.env.BASE_SEPOLIA_RPC_URL ||
  process.env.RPC_URL ||
  "https://sepolia.base.org";
const rawKey = process.env.OPERATOR_PRIVATE_KEY;

if (!rawKey) throw new Error("OPERATOR_PRIVATE_KEY is missing from .env.local");
const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  throw new Error("OPERATOR_PRIVATE_KEY must be a 32-byte hex value");
}
if (deployment.contract !== "SkillFiEscrowV3") throw new Error("Base smoke requires SkillFiEscrowV3");

const provider = new JsonRpcProvider(rpcUrl, 84532, { staticNetwork: true });
const operator = new Wallet(privateKey, provider);
const player1 = Wallet.createRandom().connect(provider);
const player2 = Wallet.createRandom().connect(provider);

if (operator.address.toLowerCase() !== deployment.operator.toLowerCase()) {
  throw new Error("OPERATOR_PRIVATE_KEY does not match the deployed operator address");
}

const tokenAbi = [
  "function approve(address spender,uint256 amount) returns (bool)",
  "function mint(address to,uint256 amount)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
];
const escrowAbi = [
  "function depositsEnabled() view returns (bool)",
  "function createMatch(uint256 matchId,uint256 entryFee,address expectedPlayer1)",
  "function joinMatch(uint256 matchId)",
  "function startMatch(uint256 matchId)",
  "function resolveMatch(uint256 matchId,address winner)",
  "function matches(uint256) view returns (address player1,address player2,uint256 entryFee,uint256 createdAt,bool player1Deposited,bool player2Deposited,uint8 status,uint256 startedAt,address winner,uint256 feeBpsAtCreation,uint256 waitingTimeoutAtCreation,uint256 readyGraceAtCreation,uint256 activeTimeoutAtCreation,address treasuryAtCreation,uint256 disputedAt,uint256 disputeTimeoutAtCreation)",
];

const tokenOperator = new Contract(deployment.mockUsdc, tokenAbi, operator);
const escrowOperator = new Contract(deployment.escrow, escrowAbi, operator);
const tokenPlayer1 = new Contract(deployment.mockUsdc, tokenAbi, player1);
const tokenPlayer2 = new Contract(deployment.mockUsdc, tokenAbi, player2);
const escrowPlayer1 = new Contract(deployment.escrow, escrowAbi, player1);
const escrowPlayer2 = new Contract(deployment.escrow, escrowAbi, player2);
const entryFee = parseUnits("1", 6);
const matchId = BigInt(`0x${crypto.randomUUID().replaceAll("-", "")}`);
const transactions = {};

if (!(await escrowOperator.depositsEnabled())) {
  throw new Error(
    "Base Sepolia deposits are disabled. Have the configured admin/multisig enable deposits, validate with BASE_EXPECT_DEPOSITS_ENABLED=1, then run the live smoke."
  );
}

async function send(label, transactionPromise) {
  const transaction = await transactionPromise;
  transactions[label] = transaction.hash;
  const receipt = await transaction.wait();
  if (receipt.status !== 1) throw new Error(`${label} transaction reverted`);
}

async function waitForAllowance(contract, owner) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (await contract.allowance(owner, deployment.escrow) === entryFee) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
  }
  throw new Error(`Allowance for ${owner} was not visible on-chain after approval`);
}

console.log(`Live V3 smoke match ${matchId} is starting on Base Sepolia...`);

for (const [label, wallet] of [["player1", player1], ["player2", player2]]) {
  await send(`fund-${label}-gas`, operator.sendTransaction({
    to: wallet.address,
    value: parseUnits("0.00005", 18),
  }));
  await send(`mint-${label}`, tokenOperator.mint(wallet.address, entryFee));
}

await send("createMatch", escrowOperator.createMatch(matchId, entryFee, player1.address));
await send("approvePlayer1", tokenPlayer1.approve(deployment.escrow, entryFee));
await waitForAllowance(tokenPlayer1, player1.address);
await send("joinPlayer1", escrowPlayer1.joinMatch(matchId, { gasLimit: 220_000n }));
await send("approvePlayer2", tokenPlayer2.approve(deployment.escrow, entryFee));
await waitForAllowance(tokenPlayer2, player2.address);
await send("joinPlayer2", escrowPlayer2.joinMatch(matchId, { gasLimit: 220_000n }));
await send("startMatch", escrowOperator.startMatch(matchId, { gasLimit: 180_000n }));
await send("resolveMatch", escrowOperator.resolveMatch(matchId, player1.address, { gasLimit: 300_000n }));

let match;
let escrowBalance;
let player2Balance;
for (let attempt = 0; attempt < 20; attempt += 1) {
  [match, escrowBalance, player2Balance] = await Promise.all([
    escrowOperator.matches(matchId),
    tokenOperator.balanceOf(deployment.escrow),
    tokenOperator.balanceOf(player2.address),
  ]);
  if (match.status === 4n && escrowBalance === 0n) break;
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
}

const checks = {
  statusResolved: match.status === 4n,
  player1MatchesBoundCreator: match.player1.toLowerCase() === player1.address.toLowerCase(),
  player2Matches: match.player2.toLowerCase() === player2.address.toLowerCase(),
  canonicalWinnerStored: match.winner.toLowerCase() === player1.address.toLowerCase(),
  bothDeposited: match.player1Deposited && match.player2Deposited,
  escrowEmpty: escrowBalance === 0n,
  loserTokenBalanceZero: player2Balance === 0n,
  feePolicyLocked: match.feeBpsAtCreation === BigInt(deployment.platformFeeBps),
  treasuryPolicyLocked: match.treasuryAtCreation.toLowerCase() === deployment.treasury.toLowerCase(),
};

console.log(JSON.stringify({
  chainId: 84532,
  contract: deployment.contract,
  matchId: matchId.toString(),
  escrow: deployment.escrow,
  operator: operator.address,
  player1: player1.address,
  player2: player2.address,
  transactions,
  checks,
}, null, 2));

if (Object.values(checks).some((value) => value !== true)) {
  process.exitCode = 1;
}
