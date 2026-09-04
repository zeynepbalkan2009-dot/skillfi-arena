import "server-only";

const TEST_AUTH_ENV_NAMES = [
  "SKILLFI_TEST_PRIVY_TOKEN_MAP",
  "SKILLFI_TEST_PRIVY_USERS",
] as const;

export function assertTestAuthDisabledOnHostedRuntime(): void {
  const testAuthEnabled = TEST_AUTH_ENV_NAMES.some((name) => Boolean(process.env[name]));
  if (!testAuthEnabled) return;

  const isHostedRuntime = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const isProductionRuntime = process.env.NODE_ENV === "production";

  if (isHostedRuntime || isProductionRuntime) {
    throw new Error(
      "Refusing to start with SkillFi test authentication enabled outside a local/test runtime."
    );
  }
}
