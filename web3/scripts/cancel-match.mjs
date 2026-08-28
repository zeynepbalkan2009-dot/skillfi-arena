import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { Contract, JsonRpcProvider, Wallet } from "ethers";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env.local"), quiet: true });
const deployment = JSON.parse(
  readFileSync(new URL("../deployments/base-sepolia.json", import.meta.url), "utf8"),
);
const matchId = process.argv[2];
if (!matchId) throw new Error("Usage: node scripts/cancel-match.mjs <matchId>");

const rawKey = process.env.OPERATOR_PRIVATE_KEY;
if (!rawKey) throw new Error("OPERATOR_PRIVATE_KEY is missing");
const provider = new JsonRpcProvider(
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || process.env.RPC_URL || "https://sepolia.base.org",
  84532,
  { staticNetwork: true },
);
const operator = new Wallet(rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`, provider);
const escrow = new Contract(
  deployment.escrow,
  ["function cancelMatch(uint256 matchId)"],
  operator,
);
const transaction = await escrow.cancelMatch(matchId);
const receipt = await transaction.wait();
if (receipt.status !== 1) throw new Error("Cancellation reverted");
console.log(JSON.stringify({ matchId, transactionHash: transaction.hash, refunded: true }, null, 2));
