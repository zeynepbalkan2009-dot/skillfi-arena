import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { Contract, JsonRpcProvider, Wallet, getAddress } from "ethers";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env.local"), quiet: true });
const deployment = JSON.parse(
  readFileSync(new URL("../deployments/base-sepolia-v3.json", import.meta.url), "utf8"),
);
if (deployment.contract !== "SkillFiEscrowV3" || deployment.chainId !== 84532) {
  throw new Error("Cancellation tool requires a Base Sepolia SkillFiEscrowV3 manifest");
}

const rawMatchId = process.argv[2];
if (!rawMatchId || !/^\d+$/.test(rawMatchId)) {
  throw new Error("Usage: node scripts/cancel-match.mjs <numericMatchId>");
}
const matchId = BigInt(rawMatchId);

const rawKey = process.env.OPERATOR_PRIVATE_KEY?.trim();
if (!rawKey) throw new Error("OPERATOR_PRIVATE_KEY is missing");
const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  throw new Error("OPERATOR_PRIVATE_KEY must be a 32-byte hex value");
}

const provider = new JsonRpcProvider(
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || process.env.RPC_URL || "https://sepolia.base.org",
  84532,
  { staticNetwork: true },
);
if ((await provider.getNetwork()).chainId !== 84532n) throw new Error("Wrong chain");

const operator = new Wallet(privateKey, provider);
if (getAddress(operator.address) !== getAddress(deployment.operator)) {
  throw new Error("OPERATOR_PRIVATE_KEY does not match deployment.operator");
}

const code = await provider.getCode(deployment.escrow);
if (code === "0x") throw new Error("No escrow bytecode at deployment.escrow");
const escrow = new Contract(
  deployment.escrow,
  [
    "function cancelMatch(uint256 matchId)",
    "function matches(uint256) view returns (address player1,address player2,uint256 entryFee,uint256 createdAt,bool player1Deposited,bool player2Deposited,uint8 status,uint256 startedAt,address winner,uint256 feeBpsAtCreation,uint256 waitingTimeoutAtCreation,uint256 readyGraceAtCreation,uint256 activeTimeoutAtCreation,address treasuryAtCreation,uint256 disputedAt,uint256 disputeTimeoutAtCreation)",
  ],
  operator,
);

const before = await escrow.matches(matchId);
if (before.status !== 1n && before.status !== 2n) {
  throw new Error(`Refusing cancellation: on-chain match state ${before.status} is not WAITING_FOR_PLAYERS or READY`);
}

const transaction = await escrow.cancelMatch(matchId);
const receipt = await transaction.wait();
if (receipt.status !== 1) throw new Error("Cancellation reverted");
const after = await escrow.matches(matchId);
if (after.status !== 6n) throw new Error(`Cancellation receipt succeeded but state is ${after.status}, expected CANCELLED`);

console.log(JSON.stringify({
  contract: deployment.contract,
  chainId: deployment.chainId,
  escrow: deployment.escrow,
  operator: operator.address,
  matchId: matchId.toString(),
  transactionHash: transaction.hash,
  beforeStatus: Number(before.status),
  afterStatus: Number(after.status),
  refunded: true,
}, null, 2));
