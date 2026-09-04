import "server-only";

import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function bucket(route: string, subject: string): string {
  return createHash("sha256").update(`${route}:${subject}`, "utf8").digest("hex");
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

  if (error) throw new Error(`Rate limit check failed: ${error.message}`);
  const row = data as { allowed: boolean; remaining: number; retry_after_seconds: number };
  return {
    allowed: Boolean(row.allowed),
    remaining: Number(row.remaining ?? 0),
    retryAfterSeconds: Number(row.retry_after_seconds ?? 0),
  };
}
