import type { Chain } from "viem";
import { getPublicEnv } from "@/lib/env/public";

/**
 * Targeting Base Sepolia (testnet) by default since this is still an MVP —
 * swap to `base` from "wagmi/chains" and update the env vars below for a
 * mainnet deployment. Keeping this in one place means that's a one-line
 * change, not a find-and-replace across the codebase.
 */
export const ACTIVE_CHAIN = {
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

const env = getPublicEnv();

export const ESCROW_CONTRACT_ADDRESS = env.NEXT_PUBLIC_ESCROW_ADDRESS;

export const USDC_TOKEN_ADDRESS = env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS;
export const GNESS_TOKEN_ADDRESS = USDC_TOKEN_ADDRESS;
