import type { Chain } from "viem";
import { getPublicEnv } from "@/lib/env/public";

const ARC_TESTNET = {
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] }, public: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
} as const satisfies Chain;

const BASE_SEPOLIA = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.base.org"] }, public: { http: ["https://sepolia.base.org"] } },
  blockExplorers: { default: { name: "BaseScan", url: "https://sepolia.basescan.org" } },
  testnet: true,
} as const satisfies Chain;

export const CHAIN_TARGET = process.env.NEXT_PUBLIC_CHAIN_TARGET === "arcTestnet" ? "arcTestnet" : "baseSepolia";
export const ACTIVE_CHAIN: Chain = CHAIN_TARGET === "arcTestnet" ? ARC_TESTNET : BASE_SEPOLIA;

const env = getPublicEnv();

export const ACTIVE_RPC_URL = CHAIN_TARGET === "arcTestnet"
  ? process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || ARC_TESTNET.rpcUrls.default.http[0]
  : env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL;

export const ESCROW_CONTRACT_ADDRESS = env.NEXT_PUBLIC_ESCROW_ADDRESS;

export const USDC_TOKEN_ADDRESS = env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS;
export const GNESS_TOKEN_ADDRESS = USDC_TOKEN_ADDRESS;
