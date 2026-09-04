import "server-only";
import { PrivyClient } from "@privy-io/node";
import { getServerEnv } from "@/lib/env/server";
import { assertTestAuthDisabledOnHostedRuntime } from "@/lib/security/runtimeGuards";

let cachedPrivy: PrivyClient | null = null;

function requirePrivyEnv() {
  const env = getServerEnv();
  return { appId: env.NEXT_PUBLIC_PRIVY_APP_ID, appSecret: env.PRIVY_APP_SECRET };
}

/**
 * SERVER-ONLY. Lazily constructed so Next.js can compile route handlers
 * during `next build` without requiring production secrets at build time.
 */
export function getPrivyClient(): PrivyClient {
  if (!cachedPrivy) {
    cachedPrivy = new PrivyClient(requirePrivyEnv());
  }
  return cachedPrivy;
}

export async function verifyPrivyAccessToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);

  assertTestAuthDisabledOnHostedRuntime();

  if (process.env.SKILLFI_TEST_PRIVY_TOKEN_MAP) {
    try {
      const tokenMap = JSON.parse(process.env.SKILLFI_TEST_PRIVY_TOKEN_MAP) as Record<string, string>;
      return tokenMap[token] ?? null;
    } catch {
      return null;
    }
  }

  try {
    const claims = await getPrivyClient().utils().auth().verifyAuthToken(token);
    return claims.user_id;
  } catch {
    return null;
  }
}
