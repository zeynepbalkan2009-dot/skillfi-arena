import { readFileSync } from "node:fs";
import { createPublicClient, defineChain, http, keccak256, stringToBytes } from "viem";

const deployment = JSON.parse(readFileSync(new URL("../deployments/arc-testnet.json", import.meta.url), "utf8"));
const expectedUsdc = "0x3600000000000000000000000000000000000000";
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
];
const operatorRole = keccak256(stringToBytes("OPERATOR_ROLE"));
const arbiterRole = keccak256(stringToBytes("ARBITER_ROLE"));
const [chainId, escrowCode, tokenCode, hasOperatorRole, hasArbiterRole, token, treasury, feeBps] = await Promise.all([
  client.getChainId(),
  client.getCode({ address: deployment.escrow }),
  client.getCode({ address: expectedUsdc }),
  client.readContract({ address: deployment.escrow, abi, functionName: "hasRole", args: [operatorRole, deployment.operator] }),
  client.readContract({ address: deployment.escrow, abi, functionName: "hasRole", args: [arbiterRole, deployment.arbiter] }),
  client.readContract({ address: deployment.escrow, abi, functionName: "token" }),
  client.readContract({ address: deployment.escrow, abi, functionName: "treasury" }),
  client.readContract({ address: deployment.escrow, abi, functionName: "platformFeeBps" }),
]);
const checks = {
  chainId: chainId === 5_042_002,
  escrowBytecode: Boolean(escrowCode && escrowCode !== "0x"),
  canonicalUsdcBytecode: Boolean(tokenCode && tokenCode !== "0x"),
  operatorRole: hasOperatorRole,
  arbiterRole: hasArbiterRole,
  tokenMatchesCanonicalUsdc: token.toLowerCase() === expectedUsdc.toLowerCase(),
  treasuryMatches: treasury.toLowerCase() === deployment.treasury.toLowerCase(),
  feeMatches: feeBps === BigInt(deployment.platformFeeBps),
};
console.log(JSON.stringify({ deployment, checks }, null, 2));
if (Object.values(checks).some((value) => value !== true)) process.exitCode = 1;
