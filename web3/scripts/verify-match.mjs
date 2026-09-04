import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { Contract, JsonRpcProvider, keccak256 } from "ethers";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env.local"), quiet: true });
const deployment = JSON.parse(
  readFileSync(new URL("../deployments/base-sepolia-v3.json", import.meta.url), "utf8"),
);
if (deployment.contract !== "SkillFiEscrowV3" || deployment.chainId !== 84532) {
  throw new Error("Match verification requires a Base Sepolia SkillFiEscrowV3 manifest");
}

const rawMatchId = process.argv[2];
if (!rawMatchId || !/^\d+$/.test(rawMatchId)) {
  throw new Error("Usage: node scripts/verify-match.mjs <numericMatchId>");
}
const matchId = BigInt(rawMatchId);

const provider = new JsonRpcProvider(
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || process.env.RPC_URL || "https://sepolia.base.org",
  84532,
  { staticNetwork: true },
);
if ((await provider.getNetwork()).chainId !== 84532n) throw new Error("Wrong chain");
const runtimeCode = await provider.getCode(deployment.escrow);
if (runtimeCode === "0x") throw new Error("No escrow bytecode at deployment.escrow");
if (deployment.runtimeCodeHash && keccak256(runtimeCode) !== deployment.runtimeCodeHash) {
  throw new Error("Escrow runtime bytecode does not match the deployment manifest");
}

const escrow = new Contract(
  deployment.escrow,
  ["function matches(uint256) view returns (address player1,address player2,uint256 entryFee,uint256 createdAt,bool player1Deposited,bool player2Deposited,uint8 status,uint256 startedAt,address winner,uint256 feeBpsAtCreation,uint256 waitingTimeoutAtCreation,uint256 readyGraceAtCreation,uint256 activeTimeoutAtCreation,address treasuryAtCreation,uint256 disputedAt,uint256 disputeTimeoutAtCreation)"],
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
const checks = {
  statusResolved: match.status === 4n,
  canonicalWinnerStored: match.winner !== "0x0000000000000000000000000000000000000000",
  bothPlayersBound: match.player1 !== "0x0000000000000000000000000000000000000000" && match.player2 !== "0x0000000000000000000000000000000000000000",
  feePolicyMatchesManifest: match.feeBpsAtCreation === BigInt(deployment.platformFeeBps),
  treasuryPolicyMatchesManifest: match.treasuryAtCreation.toLowerCase() === deployment.treasury.toLowerCase(),
  escrowEmpty: escrowBalance === 0n,
};
console.log(JSON.stringify({
  contract: deployment.contract,
  chainId: deployment.chainId,
  escrow: deployment.escrow,
  matchId: matchId.toString(),
  status: Number(match.status),
  winner: match.winner,
  escrowBalance: escrowBalance.toString(),
  checks,
}, null, 2));
if (Object.values(checks).some((value) => value !== true)) process.exitCode = 1;
