"use client";

import { useState, type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthSync } from "@/components/AuthSync";
import { ACTIVE_CHAIN } from "@/lib/contracts";
import { getPublicEnv } from "@/lib/env/public";
import { wagmiConfig } from "@/lib/wagmi";

const publicEnv = getPublicEnv();

export function PrivyRuntimeProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PrivyProvider
      appId={publicEnv.NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: { theme: "dark", accentColor: "#22d3ee" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        walletConnectCloudProjectId: publicEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
        defaultChain: ACTIVE_CHAIN,
        supportedChains: [ACTIVE_CHAIN],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <AuthSync>{children}</AuthSync>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
