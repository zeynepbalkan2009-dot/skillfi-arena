type PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_PRIVY_APP_ID: string;
  NEXT_PUBLIC_ESCROW_ADDRESS: `0x${string}`;
  NEXT_PUBLIC_USDC_TOKEN_ADDRESS: `0x${string}`;
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: string;
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: string;
};

function required(name: keyof PublicEnv): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.local.example to .env.local and set a value.`);
  }
  return value;
}

function address(name: keyof PublicEnv): `0x${string}` {
  const value = required(name);
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed 20-byte EVM address.`);
  }
  return value as `0x${string}`;
}

function url(name: keyof PublicEnv): string {
  const value = required(name);
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  return value;
}

export function getPublicEnv(): PublicEnv {
  return {
    NEXT_PUBLIC_SUPABASE_URL: url("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    NEXT_PUBLIC_PRIVY_APP_ID: required("NEXT_PUBLIC_PRIVY_APP_ID"),
    NEXT_PUBLIC_ESCROW_ADDRESS: address("NEXT_PUBLIC_ESCROW_ADDRESS"),
    NEXT_PUBLIC_USDC_TOKEN_ADDRESS: address("NEXT_PUBLIC_USDC_TOKEN_ADDRESS"),
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: required("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"),
    NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: url("NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL"),
  };
}

export function parseUsdcUnits(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("USDC amount must have at most 6 decimal places.");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

export function formatUsdcUnits(rawAmount: string | bigint): string {
  const value = typeof rawAmount === "bigint" ? rawAmount : BigInt(rawAmount);
  const whole = value / 1_000_000n;
  const fraction = value % 1_000_000n;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(6, "0").replace(/0+$/, "")}`;
}
