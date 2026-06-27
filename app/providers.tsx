"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { base, mainnet } from "wagmi/chains";

const queryClient = new QueryClient();

// Privy-Wagmi adaptörü için konfigürasyon
const wagmiConfig = createConfig({
  chains: [base, mainnet],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["email", "discord", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#0ea5e9", // E-spor temasına uygun bir mavi
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets", // Sadece Web2 ile girenlere cüzdan aç
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}