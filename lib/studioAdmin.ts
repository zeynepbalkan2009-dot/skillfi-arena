import "server-only";

import type { PlayerProfile } from "@/lib/types";

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isStudioAdmin(user: PlayerProfile): boolean {
  const configuredIds = csv(process.env.STUDIO_ADMIN_USER_IDS);
  if (configuredIds.includes(user.id)) return true;

  const configuredWallets = csv(process.env.STUDIO_ADMIN_WALLET_ADDRESSES).map((value) => value.toLowerCase());
  const wallet = user.wallet_address?.toLowerCase();
  return Boolean(wallet && configuredWallets.includes(wallet));
}
