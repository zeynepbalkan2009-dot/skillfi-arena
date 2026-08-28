import "server-only";

import type { PlayerProfile } from "@/lib/types";

export function isStudioAdmin(user: PlayerProfile): boolean {
  const configuredIds = (process.env.STUDIO_ADMIN_USER_IDS ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (configuredIds.includes(user.id)) return true;
  const operator = process.env.OPERATOR_WALLET_ADDRESS?.toLowerCase();
  const wallet = user.wallet_address?.toLowerCase();
  return Boolean(operator && wallet && operator === wallet);
}

