type PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_PRIVY_APP_ID: string;
  NEXT_PUBLIC_ESCROW_ADDRESS: `0x${string}`;
  NEXT_PUBLIC_USDC_TOKEN_ADDRESS: `0x${string}`;
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: string;
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: string;
};

const BUILD_DEFAULTS: PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_PRIVY_APP_ID: "privy-app-id",
  NEXT_PUBLIC_ESCROW_ADDRESS: "0x0000000000000000000000000000000000000000",
  NEXT_PUBLIC_USDC_TOKEN_ADDRESS: "0x0000000000000000000000000000000000000000",
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "walletconnect-project-id",
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: "https://sepolia.base.org",
};

const RAW_PUBLIC_ENV: Record<keyof PublicEnv, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  NEXT_PUBLIC_ESCROW_ADDRESS: process.env.NEXT_PUBLIC_ESCROW_ADDRESS,
  NEXT_PUBLIC_USDC_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS,
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
};

function allowLocalBuildPlaceholders(): boolean {
  return (
    process.env.npm_lifecycle_event === "build" &&
    process.env.SKILLFI_ALLOW_BUILD_PLACEHOLDERS === "1" &&
    !process.env.VERCEL &&
    !process.env.VERCEL_ENV
  );
}

function allowPreviewContractPlaceholder(name: keyof PublicEnv): boolean {
  return (
    process.env.VERCEL_ENV === "preview" &&
    (name === "NEXT_PUBLIC_ESCROW_ADDRESS" || name === "NEXT_PUBLIC_USDC_TOKEN_ADDRESS")
  );
}

function canUsePlaceholder(name: keyof PublicEnv): boolean {
  return allowLocalBuildPlaceholders() || allowPreviewContractPlaceholder(name);
}

function required(name: keyof PublicEnv): string {
  const value = RAW_PUBLIC_ENV[name]?.trim();
  if (!value) {
    if (canUsePlaceholder(name)) return BUILD_DEFAULTS[name];
    throw new Error(`Missing ${name}. Production and hosted builds fail closed.`);
  }
  return value;
}

function nonPlaceholder(name: keyof PublicEnv): string {
  const value = required(name);
  const knownBad = new Set([
    BUILD_DEFAULTS[name],
    "your-walletconnect-project-id",
    "your-privy-app-id",
    "your-supabase-anon-key",
  ]);
  if (knownBad.has(value) && !canUsePlaceholder(name)) {
    throw new Error(`${name} still contains a placeholder value.`);
  }
  return value;
}

function address(name: keyof PublicEnv): `0x${string}` {
  const value = required(name);
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    if (canUsePlaceholder(name)) return BUILD_DEFAULTS[name] as `0x${string}`;
    throw new Error(`${name} must be a 0x-prefixed 20-byte EVM address.`);
  }
  if (/^0x0{40}$/i.test(value) && !canUsePlaceholder(name)) {
    throw new Error(`${name} must not be the zero address.`);
  }
  return value as `0x${string}`;
}

function url(name: keyof PublicEnv): string {
  const value = required(name);
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
    if ((process.env.VERCEL || process.env.VERCEL_ENV) && parsed.protocol !== "https:") {
      throw new Error("hosted URLs must use https");
    }
  } catch {
    if (allowLocalBuildPlaceholders()) return BUILD_DEFAULTS[name];
    throw new Error(`${name} must be a valid HTTP(S) URL; hosted builds require HTTPS.`);
  }
  return value;
}

export function getPublicEnv(): PublicEnv {
  return {
    NEXT_PUBLIC_SUPABASE_URL: url("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: nonPlaceholder("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    NEXT_PUBLIC_PRIVY_APP_ID: nonPlaceholder("NEXT_PUBLIC_PRIVY_APP_ID"),
    NEXT_PUBLIC_ESCROW_ADDRESS: address("NEXT_PUBLIC_ESCROW_ADDRESS"),
    NEXT_PUBLIC_USDC_TOKEN_ADDRESS: address("NEXT_PUBLIC_USDC_TOKEN_ADDRESS"),
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: nonPlaceholder("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"),
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
