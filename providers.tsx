"use client";

import { useState, type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { ACTIVE_CHAIN } from "@/lib/contracts";
import { AuthSync } from "@/components/AuthSync";

function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

const privyAppId = requireEnv(process.env.NEXT_PUBLIC_PRIVY_APP_ID, "NEXT_PUBLIC_PRIVY_APP_ID");

export function Providers({ children }: { children: ReactNode }) {
  // Created inside the component (not module scope) so each browser tab
  // / SSR request gets its own cache — sharing one across requests on the
  // server is a classic source of cross-user data leaking into the cache.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: { theme: "dark", accentColor: "#22d3ee" },
        // Note the nesting: embeddedWallets.ethereum.createOnLogin, not a
        // flat embeddedWallets.createOnLogin — easy to get wrong since
        // several blog posts/older docs show the flat (pre-chain-scoped)
        // shape, which doesn't type-check against the current SDK.
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        defaultChain: ACTIVE_CHAIN,
        supportedChains: [ACTIVE_CHAIN],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {/* AuthSync provides the useSkillFiUser() context to everything
              beneath it — it needs to wrap children, not sit beside them. */}
          <AuthSync>{children}</AuthSync>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
