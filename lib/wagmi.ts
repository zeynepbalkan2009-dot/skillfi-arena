import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { ACTIVE_CHAIN } from "@/lib/contracts";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!walletConnectProjectId) {
  throw new Error(
    "Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. Get one free at https://cloud.walletconnect.com."
  );
}

/**
 * `ssr: true` is required for the App Router: it tells Wagmi to defer
 * reading any persisted connection state until after hydration, avoiding
 * a server/client markup mismatch on first paint.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "SkillFi Arena",
  projectId: walletConnectProjectId,
  chains: [ACTIVE_CHAIN],
  ssr: true,
});
