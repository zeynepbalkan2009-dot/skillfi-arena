import "server-only";

import { createHmac } from "node:crypto";
import { getServerEnv } from "@/lib/env/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function bucket(route: string, subject: string): string {
  // Subjects are internal identity identifiers, not passwords. Use a keyed
  // digest anyway so a database leak cannot be used to correlate raw Privy,
  // user, or integration-credential identifiers across systems.
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  return createHmac("sha256", SUPABASE_SERVICE_ROLE_KEY)
    .update(`${route}:${subject}`, "utf8")
    .digest("hex");
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
