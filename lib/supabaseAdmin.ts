import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env/server";

/**
 * SERVER-ONLY. service_role bypasses every RLS policy in the schema.
 *
 * The client is created lazily so `next build` can compile route modules
 * without requiring server-only credentials in the build environment.
 * Protected runtime requests still fail clearly when secrets are missing.
 */
type SupabaseAdminClient = any;

let adminClient: SupabaseAdminClient | null = null;

export function getSupabaseAdmin(): SupabaseAdminClient {
  if (!adminClient) {
    const env = getServerEnv();
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export const supabaseAdmin = new Proxy({} as SupabaseAdminClient, {
  get(_target, property) {
    return Reflect.get(getSupabaseAdmin(), property);
  },
});
