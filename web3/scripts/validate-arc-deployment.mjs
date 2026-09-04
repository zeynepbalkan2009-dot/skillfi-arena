import { readFileSync } from "node:fs";
import { createPublicClient, defineChain, http, keccak256, stringToBytes } from "viem";

const deployment = JSON.parse(
  readFileSync(new URL("../deployments/arc-testnet-v3.json", import.meta.url), "utf8")
);
const expectedUsdc = "0x3600000000000000000000000000000000000000";
const zeroAddress = "0x0000000000000000000000000000000000000000";
const defaultAdminRole = `0x${"00".repeat(32)}`;

const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});

const client = createPublicClient({ chain: arcTestnet, transport: http() });
const abi = [
  { type: "function", name: "hasRole", stateMutability: "view", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "treasury", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "platformFeeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "matchTimeout", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "readyMatchGrace", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "activeMatchTimeout", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "disputeTimeout", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
];

function distinctCriticalRoles() {
  const critical = [deployment.deployer, deployment.admin, deployment.operator, deployment.arbiter, deployment.treasury]
    .map((value) => String(value).toLowerCase());
  return critical.every((value) => value !== zeroAddress) && new Set(critical).size === critical.length;
}

const operatorRole = keccak256(stringToBytes("OPERATOR_ROLE"));
const arbiterRole = keccak256(stringToBytes("ARBITER_ROLE"));
const escrowAddress = deployment.escrow;
const roleChecks = await Promise.all([
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [defaultAdminRole, deployment.admin] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [operatorRole, deployment.operator] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [arbiterRole, deployment.arbiter] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [defaultAdminRole, deployment.deployer] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [operatorRole, deployment.deployer] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [arbiterRole, deployment.deployer] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [operatorRole, deployment.admin] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [arbiterRole, deployment.admin] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [defaultAdminRole, deployment.operator] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [arbiterRole, deployment.operator] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [defaultAdminRole, deployment.arbiter] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [operatorRole, deployment.arbiter] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [defaultAdminRole, deployment.treasury] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [operatorRole, deployment.treasury] }),
  client.readContract({ address: escrowAddress, abi, functionName: "hasRole", args: [arbiterRole, deployment.treasury] }),
]);

const [
  chainId,
  escrowCode,
  tokenCode,
  token,
  treasury,
  feeBps,
  waitingTimeout,
  readyGrace,
  activeTimeout,
  disputeTimeout,
  paused,
] = await Promise.all([
  client.getChainId(),
  client.getCode({ address: escrowAddress }),
  client.getCode({ address: expectedUsdc }),
  client.readContract({ address: escrowAddress, abi, functionName: "token" }),
  client.readContract({ address: escrowAddress, abi, functionName: "treasury" }),
  client.readContract({ address: escrowAddress, abi, functionName: "platformFeeBps" }),
  client.readContract({ address: escrowAddress, abi, functionName: "matchTimeout" }),
  client.readContract({ address: escrowAddress, abi, functionName: "readyMatchGrace" }),
  client.readContract({ address: escrowAddress, abi, functionName: "activeMatchTimeout" }),
  client.readContract({ address: escrowAddress, abi, functionName: "disputeTimeout" }),
  client.readContract({ address: escrowAddress, abi, functionName: "paused" }),
]);

const [
  adminHasAdminRole,
  hasOperatorRole,
  hasArbiterRole,
  deployerHasAdminRole,
  deployerHasOperatorRole,
  deployerHasArbiterRole,
  adminHasOperatorRole,
  adminHasArbiterRole,
  operatorHasAdminRole,
  operatorHasArbiterRole,
  arbiterHasAdminRole,
  arbiterHasOperatorRole,
  treasuryHasAdminRole,
  treasuryHasOperatorRole,
  treasuryHasArbiterRole,
] = roleChecks;

const checks = {
  contractVersion: deployment.contract === "SkillFiEscrowV3",
  chainId: chainId === 5_042_002,
  escrowBytecode: Boolean(escrowCode && escrowCode !== "0x"),
  runtimeCodeHash: Boolean(escrowCode && deployment.runtimeCodeHash && keccak256(escrowCode) === deployment.runtimeCodeHash),
  canonicalUsdcBytecode: Boolean(tokenCode && tokenCode !== "0x"),
  criticalRolesSeparated: distinctCriticalRoles(),
  adminRole: adminHasAdminRole,
  operatorRole: hasOperatorRole,
  arbiterRole: hasArbiterRole,
  deployerHasNoControlRole: !deployerHasAdminRole && !deployerHasOperatorRole && !deployerHasArbiterRole,
  adminHasNoExecutionRole: !adminHasOperatorRole && !adminHasArbiterRole,
  operatorHasNoOtherControlRole: !operatorHasAdminRole && !operatorHasArbiterRole,
  arbiterHasNoOtherControlRole: !arbiterHasAdminRole && !arbiterHasOperatorRole,
  treasuryHasNoControlRole: !treasuryHasAdminRole && !treasuryHasOperatorRole && !treasuryHasArbiterRole,
  tokenMatchesCanonicalUsdc: token.toLowerCase() === expectedUsdc.toLowerCase(),
  treasuryMatches: treasury.toLowerCase() === deployment.treasury.toLowerCase(),
  feeMatches: feeBps === BigInt(deployment.platformFeeBps),
  waitingTimeoutMatches: waitingTimeout === BigInt(deployment.waitingTimeout),
  readyGraceMatches: readyGrace === BigInt(deployment.readyGrace),
  activeTimeoutMatches: activeTimeout === BigInt(deployment.activeTimeout),
  disputeTimeoutMatches: disputeTimeout === BigInt(deployment.disputeTimeout),
  waitingTimeoutSafeMinimum: waitingTimeout >= 5n * 60n,
  readyGraceSafeRange: readyGrace >= 60n && readyGrace <= 60n * 60n,
  activeTimeoutSafeMinimum: activeTimeout >= 5n * 60n,
  disputeTimeoutSafeRange: disputeTimeout >= 24n * 60n * 60n && disputeTimeout <= 30n * 24n * 60n * 60n,
  unpausedAtRelease: paused === false,
};

console.log(JSON.stringify({ deployment, checks }, null, 2));
if (Object.values(checks).some((value) => value !== true)) process.exitCode = 1;
