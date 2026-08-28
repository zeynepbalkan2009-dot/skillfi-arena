import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { Contract, JsonRpcProvider, Wallet, parseUnits } from "ethers";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env.local"), quiet: true });

const deployment = JSON.parse(
  readFileSync(new URL("../deployments/base-sepolia.json", import.meta.url), "utf8"),
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

const provider = new JsonRpcProvider(rpcUrl, 84532, { staticNetwork: true });
const operator = new Wallet(privateKey, provider);
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
  "function createMatch(uint256 matchId,uint256 entryFee)",
  "function joinMatch(uint256 matchId)",
  "function startMatch(uint256 matchId)",
  "function resolveMatch(uint256 matchId,address winner)",
  "function matches(uint256) view returns (address player1,address player2,uint256 entryFee,uint256 createdAt,bool player1Deposited,bool player2Deposited,uint8 status)",
];

const token = new Contract(deployment.mockUsdc, tokenAbi, operator);
const escrow = new Contract(deployment.escrow, escrowAbi, operator);
const entryFee = parseUnits("1", 6);
const matchId = BigInt(`0x${crypto.randomUUID().replaceAll("-", "")}`);
const transactions = {};

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

console.log(`Live smoke match ${matchId} is starting on Base Sepolia...`);

await send("fundPlayer2Gas", operator.sendTransaction({
  to: player2.address,
  value: parseUnits("0.00005", 18),
}));
await send("mintPlayer2", token.mint(player2.address, entryFee));
await send("createMatch", escrow.createMatch(matchId, entryFee));
await send("approvePlayer1", token.approve(deployment.escrow, entryFee));
await waitForAllowance(token, operator.address);
await send("joinPlayer1", escrow.joinMatch(matchId, { gasLimit: 200_000n }));

const player2Token = new Contract(deployment.mockUsdc, tokenAbi, player2);
const player2Escrow = new Contract(deployment.escrow, escrowAbi, player2);
await send("approvePlayer2", player2Token.approve(deployment.escrow, entryFee));
await waitForAllowance(player2Token, player2.address);
await send("joinPlayer2", player2Escrow.joinMatch(matchId, { gasLimit: 200_000n }));
await send("startMatch", escrow.startMatch(matchId, { gasLimit: 150_000n }));
await send("resolveMatch", escrow.resolveMatch(matchId, operator.address, { gasLimit: 250_000n }));

let match;
let escrowBalance;
let player2Balance;
for (let attempt = 0; attempt < 20; attempt += 1) {
  [match, escrowBalance, player2Balance] = await Promise.all([
    escrow.matches(matchId),
    token.balanceOf(deployment.escrow),
    token.balanceOf(player2.address),
  ]);
  if (match.status === 4n && escrowBalance === 0n) break;
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
}

const checks = {
  statusResolved: match.status === 4n,
  player1Matches: match.player1.toLowerCase() === operator.address.toLowerCase(),
  player2Matches: match.player2.toLowerCase() === player2.address.toLowerCase(),
  bothDeposited: match.player1Deposited && match.player2Deposited,
  escrowEmpty: escrowBalance === 0n,
  loserTokenBalanceZero: player2Balance === 0n,
};

console.log(JSON.stringify({
  chainId: 84532,
  matchId: matchId.toString(),
  escrow: deployment.escrow,
  player1: operator.address,
  player2: player2.address,
  transactions,
  checks,
}, null, 2));

if (Object.values(checks).some((value) => value !== true)) {
  process.exitCode = 1;
}
