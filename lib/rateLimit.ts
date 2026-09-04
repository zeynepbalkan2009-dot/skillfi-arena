import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function bucket(route: string, subject: string): string {
  // Callers pass server-resolved internal identifiers (Privy user id, SkillFi
  // user UUID, or credential UUID), never a password or bearer secret. The
  // backing table is service-role only, so storing the bounded identifier is
  // clearer and avoids misclassifying an internal id as password material.
  const key = `${route}:${subject}`;
  if (key.length < 16 || key.length > 128) {
    throw new Error("Invalid rate-limit bucket identifier.");
  }
  return key;
}

export async function consumeRateLimit(
  route: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const { data, error } = await supabaseAdmin
    .rpc("consume_api_rate_limit", {
      p_bucket_key: bucket(route, subject),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    .single();

  if (error) throw new Error("Rate limit check failed.");
  const row = data as { allowed: boolean; remaining: number; retry_after_seconds: number };
  return {
    allowed: Boolean(row.allowed),
    remaining: Number(row.remaining ?? 0),
    retryAfterSeconds: Number(row.retry_after_seconds ?? 0),
  };
}
