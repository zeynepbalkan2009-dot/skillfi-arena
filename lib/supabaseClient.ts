import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env/public";

const env = getPublicEnv();

/**
 * Single shared anon-key client for the whole app — public reads
 * (matches, games, ratings, public user fields) and the realtime
 * subscription only.
 *
 * Deliberately NOT a "give me a client with this Privy token attached"
 * factory. An earlier draft of this file took a `privyAccessToken`
 * parameter and injected it as an Authorization header, on the theory
 * that doing so would make `auth.uid()` resolve to the calling user in
 * RLS policies. That doesn't work, for two independent reasons:
 *
 *  1. Privy is not one of Supabase's supported Third-Party Auth
 *     providers (Clerk, Firebase Auth, Auth0, AWS Cognito, WorkOS —
 *     Privy isn't on that list), so Supabase has no configured way to
 *     verify a Privy-signed JWT's signature in the first place.
 *
 *  2. Even setting that aside, a Privy access token's `sub` claim is a
 *     Privy DID string (e.g. "did:privy:cl812utgs..."), not a UUID, and
 *     carries no `role` claim. `auth.uid()` casts `sub` to `::uuid` —
 *     against a DID string that cast throws outright, so every
 *     RLS-gated query would error rather than just being denied.
 *
 * Anything that needs to know "which authenticated user is making this
 * request" goes through a Route Handler instead: the handler verifies
 * the Privy access token server-side with lib/privy.ts, resolves it to
 * a `public.users` row, and reads/writes via supabaseAdmin
 * (service_role). See app/api/matches/create/route.ts and
 * app/api/auth/sync/route.ts for the pattern.
 */
export const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
