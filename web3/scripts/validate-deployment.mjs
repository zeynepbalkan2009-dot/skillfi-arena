import { readFileSync } from "node:fs";
import {
  Contract,
  JsonRpcProvider,
  ZeroAddress,
  ZeroHash,
  getAddress,
  keccak256,
  toUtf8Bytes,
} from "ethers";

const deployment = JSON.parse(
  readFileSync(new URL("../deployments/base-sepolia-v3.json", import.meta.url), "utf8")
);
const expectedChainId = 84_532n;
const expectedDepositsRaw = process.env.BASE_EXPECT_DEPOSITS_ENABLED?.trim() ?? "0";
if (expectedDepositsRaw !== "0" && expectedDepositsRaw !== "1") {
  throw new Error("BASE_EXPECT_DEPOSITS_ENABLED must be exactly 0 or 1");
}
const expectedDepositsEnabled = expectedDepositsRaw === "1";
const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";
const provider = new JsonRpcProvider(rpcUrl, Number(expectedChainId), { staticNetwork: true });
const abi = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function token() view returns (address)",
  "function treasury() view returns (address)",
  "function platformFeeBps() view returns (uint256)",
  "function matchTimeout() view returns (uint256)",
  "function readyMatchGrace() view returns (uint256)",
  "function activeMatchTimeout() view returns (uint256)",
  "function disputeTimeout() view returns (uint256)",
  "function depositsEnabled() view returns (bool)",
  "function paused() view returns (bool)",
];

function normalizedAddress(value, label) {
  try {
    return getAddress(String(value));
  } catch {
    throw new Error(`${label} is not a valid EVM address`);
  }
}

const escrowAddress = normalizedAddress(deployment.escrow, "deployment.escrow");
const mockUsdc = normalizedAddress(deployment.mockUsdc, "deployment.mockUsdc");
const deployer = normalizedAddress(deployment.deployer, "deployment.deployer");
const admin = normalizedAddress(deployment.admin, "deployment.admin");
const operator = normalizedAddress(deployment.operator, "deployment.operator");
const arbiter = normalizedAddress(deployment.arbiter, "deployment.arbiter");
const deploymentTreasury = normalizedAddress(deployment.treasury, "deployment.treasury");
const contract = new Contract(escrowAddress, abi, provider);

function distinctCriticalRoles() {
  const critical = [deployer, admin, operator, arbiter, deploymentTreasury].map((value) => value.toLowerCase());
  return critical.every((value) => value !== ZeroAddress.toLowerCase()) && new Set(critical).size === critical.length;
}

const operatorRole = keccak256(toUtf8Bytes("OPERATOR_ROLE"));
const arbiterRole = keccak256(toUtf8Bytes("ARBITER_ROLE"));
const [
  network,
  escrowCode,
  tokenCode,
  token,
  treasury,
  feeBps,
  waitingTimeout,
  readyGrace,
  activeTimeout,
  disputeTimeout,
  depositsEnabled,
  paused,
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
] = await Promise.all([
  provider.getNetwork(),
  provider.getCode(escrowAddress),
  provider.getCode(mockUsdc),
  contract.token(),
  contract.treasury(),
  contract.platformFeeBps(),
  contract.matchTimeout(),
  contract.readyMatchGrace(),
  contract.activeMatchTimeout(),
  contract.disputeTimeout(),
  contract.depositsEnabled(),
  contract.paused(),
  contract.hasRole(ZeroHash, admin),
  contract.hasRole(operatorRole, operator),
  contract.hasRole(arbiterRole, arbiter),
  contract.hasRole(ZeroHash, deployer),
  contract.hasRole(operatorRole, deployer),
  contract.hasRole(arbiterRole, deployer),
  contract.hasRole(operatorRole, admin),
  contract.hasRole(arbiterRole, admin),
  contract.hasRole(ZeroHash, operator),
  contract.hasRole(arbiterRole, operator),
  contract.hasRole(ZeroHash, arbiter),
  contract.hasRole(operatorRole, arbiter),
  contract.hasRole(ZeroHash, deploymentTreasury),
  contract.hasRole(operatorRole, deploymentTreasury),
  contract.hasRole(arbiterRole, deploymentTreasury),
]);

const checks = {
  contractVersion: deployment.contract === "SkillFiEscrowV3",
  chainId: network.chainId === expectedChainId,
  escrowBytecode: escrowCode !== "0x",
  runtimeCodeHash: Boolean(escrowCode !== "0x" && deployment.runtimeCodeHash && keccak256(escrowCode) === deployment.runtimeCodeHash),
  tokenBytecode: tokenCode !== "0x",
  criticalRolesSeparated: distinctCriticalRoles(),
  adminRole: adminHasAdminRole,
  operatorRole: hasOperatorRole,
  arbiterRole: hasArbiterRole,
  deployerHasNoControlRole: !deployerHasAdminRole && !deployerHasOperatorRole && !deployerHasArbiterRole,
  adminHasNoExecutionRole: !adminHasOperatorRole && !adminHasArbiterRole,
  operatorHasNoOtherControlRole: !operatorHasAdminRole && !operatorHasArbiterRole,
  arbiterHasNoOtherControlRole: !arbiterHasAdminRole && !arbiterHasOperatorRole,
  treasuryHasNoControlRole: !treasuryHasAdminRole && !treasuryHasOperatorRole && !treasuryHasArbiterRole,
  tokenMatches: getAddress(token) === mockUsdc,
  treasuryMatches: getAddress(treasury) === deploymentTreasury,
  feeMatches: feeBps === BigInt(deployment.platformFeeBps),
  waitingTimeoutMatches: waitingTimeout === BigInt(deployment.waitingTimeout),
  readyGraceMatches: readyGrace === BigInt(deployment.readyGrace),
  activeTimeoutMatches: activeTimeout === BigInt(deployment.activeTimeout),
  disputeTimeoutMatches: disputeTimeout === BigInt(deployment.disputeTimeout),
  depositsWereClosedAtDeployment: deployment.depositsEnabledAtDeployment === false,
  depositsMatchExplicitExpectation: depositsEnabled === expectedDepositsEnabled,
  waitingTimeoutSafeMinimum: waitingTimeout >= 5n * 60n,
  readyGraceSafeRange: readyGrace >= 60n && readyGrace <= 60n * 60n,
  activeTimeoutSafeMinimum: activeTimeout >= 5n * 60n,
  disputeTimeoutSafeRange: disputeTimeout >= 24n * 60n * 60n && disputeTimeout <= 30n * 24n * 60n * 60n,
  unpausedAtRelease: paused === false,
};

console.log(JSON.stringify({ deployment, expectedDepositsEnabled, checks }, null, 2));
if (Object.values(checks).some((value) => value !== true)) process.exitCode = 1;
