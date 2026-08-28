import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { Contract, JsonRpcProvider } from "ethers";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env.local"), quiet: true });
const deployment = JSON.parse(
  readFileSync(new URL("../deployments/base-sepolia.json", import.meta.url), "utf8"),
);
const matchId = process.argv[2];
if (!matchId) throw new Error("Usage: node scripts/verify-match.mjs <matchId>");

const provider = new JsonRpcProvider(
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || process.env.RPC_URL || "https://sepolia.base.org",
  84532,
  { staticNetwork: true },
);
const escrow = new Contract(
  deployment.escrow,
  ["function matches(uint256) view returns (address player1,address player2,uint256 entryFee,uint256 createdAt,bool player1Deposited,bool player2Deposited,uint8 status)"],
  provider,
);
const token = new Contract(
  deployment.mockUsdc,
  ["function balanceOf(address account) view returns (uint256)"],
  provider,
);
const [match, escrowBalance] = await Promise.all([
  escrow.matches(matchId),
  token.balanceOf(deployment.escrow),
]);
const checks = { statusResolved: match.status === 4n, escrowEmpty: escrowBalance === 0n };
console.log(JSON.stringify({ matchId, status: Number(match.status), escrowBalance: escrowBalance.toString(), checks }, null, 2));
if (Object.values(checks).some((value) => value !== true)) process.exitCode = 1;
