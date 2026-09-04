import "server-only";

import { getAddress } from "viem";
import { parseUsdcUnits } from "@/lib/env/public";

export function getStudioFeeConfig() {
  const rawAmount = process.env.STUDIO_LISTING_FEE_USDC?.trim();
  const rawTreasury = process.env.STUDIO_FEE_TREASURY_ADDRESS?.trim();
  if (!rawAmount) throw new Error("STUDIO_LISTING_FEE_USDC is not configured");
  if (!rawTreasury) throw new Error("STUDIO_FEE_TREASURY_ADDRESS is not configured");
  const amount = parseUsdcUnits(rawAmount);
  if (amount <= 0n) throw new Error("Studio listing fee must be positive");
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
