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

const rpcUrl = process.env.RPC_URL || undefined;

export const escrowPublicClient = createPublicClient({
  chain: BASE_SEPOLIA,
  transport: http(rpcUrl),
});

export function getEscrowWalletClient() {
  const operatorKey = process.env.OPERATOR_PRIVATE_KEY;
  if (!operatorKey) {
    throw new Error("Missing OPERATOR_PRIVATE_KEY. Server-side escrow operations are disabled.");
  }

  const operator = privateKeyToAccount(operatorKey as `0x${string}`);
  return createWalletClient({
    account: operator,
    chain: BASE_SEPOLIA,
    transport: http(rpcUrl),
  });
}

export function getOperatorAddress(): Address {
  const operatorKey = process.env.OPERATOR_PRIVATE_KEY;
  if (!operatorKey) {
    throw new Error("Missing OPERATOR_PRIVATE_KEY. Server-side escrow operations are disabled.");
  }
  return privateKeyToAccount(operatorKey as `0x${string}`).address;
}

export { ESCROW_CONTRACT_ADDRESS, skillFiEscrowAbi };
