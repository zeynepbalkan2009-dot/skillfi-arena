import { baseSepolia } from "wagmi/chains";

/**
 * Targeting Base Sepolia (testnet) by default since this is still an MVP —
 * swap to `base` from "wagmi/chains" and update the env vars below for a
 * mainnet deployment. Keeping this in one place means that's a one-line
 * change, not a find-and-replace across the codebase.
 */
export const ACTIVE_CHAIN = baseSepolia;

function requireAddress(value: string | undefined, name: string): `0x${string}` {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} is missing or not a valid address. Check your .env.local.`);
  }
  return value as `0x${string}`;
}

export const ESCROW_CONTRACT_ADDRESS = requireAddress(
  process.env.NEXT_PUBLIC_ESCROW_ADDRESS,
  "NEXT_PUBLIC_ESCROW_ADDRESS"
);

export const GNESS_TOKEN_ADDRESS = requireAddress(
  process.env.NEXT_PUBLIC_GNESS_TOKEN_ADDRESS,
  "NEXT_PUBLIC_GNESS_TOKEN_ADDRESS"
);
