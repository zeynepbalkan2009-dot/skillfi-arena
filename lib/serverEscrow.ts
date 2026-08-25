import "server-only";

import { createPublicClient, createWalletClient, http, type Address, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ESCROW_CONTRACT_ADDRESS } from "@/lib/contracts";
import { skillFiEscrowAbi } from "@/lib/abi/skillFiEscrow";

const BASE_SEPOLIA = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://sepolia.base.org"] },
    public: { http: ["https://sepolia.base.org"] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
  testnet: true,
} as const satisfies Chain;

function requireEnv(value: string | undefined, name: string): string {
  if (!value && process.env.npm_lifecycle_event === "build" && name === "OPERATOR_PRIVATE_KEY") {
    return "0x0000000000000000000000000000000000000000000000000000000000000001";
  }
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

const rpcUrl = process.env.RPC_URL || undefined;
const operatorKey = requireEnv(process.env.OPERATOR_PRIVATE_KEY, "OPERATOR_PRIVATE_KEY") as `0x${string}`;

const operator = privateKeyToAccount(operatorKey);

export const escrowPublicClient = createPublicClient({
  chain: BASE_SEPOLIA,
  transport: http(rpcUrl),
});

export const escrowWalletClient = createWalletClient({
  account: operator,
  chain: BASE_SEPOLIA,
  transport: http(rpcUrl),
});

export const operatorAddress: Address = operator.address;

export { ESCROW_CONTRACT_ADDRESS, skillFiEscrowAbi };
