import "server-only";
import { getPublicEnv } from "@/lib/env/public";

type ServerEnv = ReturnType<typeof getPublicEnv> & {
  PRIVY_APP_SECRET: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPERATOR_WALLET_ADDRESS: `0x${string}`;
};

function required(name: keyof ServerEnv): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env.local or your deployment secrets.`);
  }
  return value;
}

function address(name: keyof ServerEnv): `0x${string}` {
  const value = required(name);
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed 20-byte EVM address.`);
  }
  return value as `0x${string}`;
}

export function getServerEnv(): ServerEnv {
  return {
    ...getPublicEnv(),
    PRIVY_APP_SECRET: required("PRIVY_APP_SECRET"),
    SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
    OPERATOR_WALLET_ADDRESS: address("OPERATOR_WALLET_ADDRESS"),
  };
}
