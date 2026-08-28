import { readFileSync } from "node:fs";
import { createPublicClient, http, keccak256, stringToBytes } from "viem";
import { baseSepolia } from "viem/chains";

const deployment = JSON.parse(
  readFileSync(new URL("../deployments/base-sepolia.json", import.meta.url), "utf8")
);

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
});

const abi = [
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }, { type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "treasury",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "platformFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
];

const operatorRole = keccak256(stringToBytes("OPERATOR_ROLE"));
const [escrowCode, tokenCode, hasOperatorRole, token, treasury, feeBps] = await Promise.all([
  client.getCode({ address: deployment.escrow }),
  client.getCode({ address: deployment.mockUsdc }),
  client.readContract({
    address: deployment.escrow,
    abi,
    functionName: "hasRole",
    args: [operatorRole, deployment.operator],
  }),
  client.readContract({ address: deployment.escrow, abi, functionName: "token" }),
  client.readContract({ address: deployment.escrow, abi, functionName: "treasury" }),
  client.readContract({ address: deployment.escrow, abi, functionName: "platformFeeBps" }),
]);

const checks = {
  escrowBytecode: Boolean(escrowCode && escrowCode !== "0x"),
  tokenBytecode: Boolean(tokenCode && tokenCode !== "0x"),
  operatorRole: hasOperatorRole,
  tokenMatches: token.toLowerCase() === deployment.mockUsdc.toLowerCase(),
  treasuryMatches: treasury.toLowerCase() === deployment.treasury.toLowerCase(),
  feeMatches: feeBps === BigInt(deployment.platformFeeBps),
};

console.log(JSON.stringify({ deployment, checks }, null, 2));

if (Object.values(checks).some((value) => value !== true)) {
  process.exitCode = 1;
}
