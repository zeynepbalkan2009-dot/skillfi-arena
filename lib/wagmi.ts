import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { ACTIVE_CHAIN } from "@/lib/contracts";
import { getPublicEnv } from "@/lib/env/public";

/**
 * `@privy-io/wagmi`'s createConfig, not wagmi's own — Privy needs its own
 * wrapper to register its embedded-wallet connector and keep wagmi's
 * active account in sync with whichever wallet (embedded or external) the
 * user is currently using. Plain `wagmi`'s `createConfig` doesn't know
 * about Privy at all.
 *
 * No connectors array here: PrivyProvider (see app/providers.tsx) injects
 * the appropriate connectors itself based on `loginMethods` /
 * `embeddedWallets` config — adding RainbowKit/injected connectors here
 * would conflict with that.
 */
export const wagmiConfig = createConfig({
  chains: [ACTIVE_CHAIN],
  transports: {
    [ACTIVE_CHAIN.id]: http(getPublicEnv().NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
  },
});
