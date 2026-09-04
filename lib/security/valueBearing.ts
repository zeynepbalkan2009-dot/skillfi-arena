import "server-only";

/**
 * Fail-closed release switch for NEW value-bearing exposure.
 *
 * This switch intentionally gates match creation and join preflight only. It
 * must not gate settlement, cancellation, disputes, or recovery paths because
 * disabling the switch must never strand funds that were already deposited.
 */
export function isValueBearingEnabled(): boolean {
  return process.env.SKILLFI_VALUE_BEARING_ENABLED === "1";
}

export const VALUE_BEARING_DISABLED_MESSAGE =
  "Value-bearing matches are disabled until the production release gates are complete.";
