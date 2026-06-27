import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "The service role key must stay server-side only — do not prefix it with NEXT_PUBLIC_."
  );
}

/**
 * SERVER-ONLY. service_role bypasses every RLS policy in the schema.
 *
 * The `import "server-only"` line above is a build-time guard: if any
 * "use client" component or browser bundle ever tries to import this
 * module, Next.js fails the build instead of silently shipping the
 * service role key to the browser.
 *
 * Only ever import this from Route Handlers, Server Actions, or other
 * server-only code — never from a Server Component that renders to the
 * client, and never from anything under "use client".
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
