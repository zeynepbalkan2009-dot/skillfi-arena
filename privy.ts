import "server-only";
import { PrivyClient } from "@privy-io/node";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

if (!appId || !appSecret) {
  throw new Error(
    "Missing NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET. " +
      "PRIVY_APP_SECRET must stay server-side only — never prefix it with NEXT_PUBLIC_."
  );
}

/**
 * SERVER-ONLY. Constructed once per server process and reused across
 * requests — the `import "server-only"` guard at the top fails the build
 * if any client component tries to import this module, the same pattern
 * already used by lib/supabaseAdmin.ts.
 */
export const privy = new PrivyClient({ appId, appSecret });

/**
 * Verifies a Privy access token's signature and returns the caller's
 * Privy DID (`userId`), or null if the token is missing, expired, or
 * otherwise invalid. Never throws — callers should treat null as "this
 * request is unauthenticated" and respond with 401, not propagate an
 * exception up through route handling.
 *
 * IMPORTANT: this verifies the ACCESS token (short-lived, ES256-signed,
 * obtained via the frontend's `usePrivy().getAccessToken()`). It will
 * NOT work on Privy *identity* tokens, which carry a different payload
 * shape and require a separate verification path
 * (`privy.users().get({ id_token })`) — this app doesn't use identity
 * tokens, so that path isn't implemented here.
 */
export async function verifyPrivyAccessToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);

  try {
    const claims = await privy.utils().auth().verifyAuthToken(token);
    return claims.user_id; // the caller's Privy DID, e.g. "did:privy:cl812utgs..."
  } catch {
    // Expired, malformed, or signed for a different Privy app — all
    // collapse to "not authenticated" from the caller's perspective.
    return null;
  }
}
