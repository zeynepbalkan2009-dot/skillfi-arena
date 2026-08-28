import "server-only";

import { getAddress } from "viem";
import { parseUsdcUnits } from "@/lib/env/public";

export function getStudioFeeConfig() {
  const amount = parseUsdcUnits(process.env.STUDIO_LISTING_FEE_USDC ?? "100");
  const rawTreasury = process.env.STUDIO_FEE_TREASURY_ADDRESS ?? process.env.OPERATOR_WALLET_ADDRESS;
  if (!rawTreasury) throw new Error("Studio fee treasury is not configured");
  return { amount, treasury: getAddress(rawTreasury) };
}

export function normalizeStudioSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function optionalUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Website must use http or https");
  return url.toString();
}

