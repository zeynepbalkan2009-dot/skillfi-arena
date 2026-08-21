"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * RainbowKit's <ConnectButton /> is gone along with the package itself —
 * Privy's own login modal (configured in app/providers.tsx) replaces it.
 * This is a thin wrapper around usePrivy()'s login/logout, kept as its
 * own component for the same reason the original did: one place to
 * restyle later without touching every call site.
 */
export function WalletConnect() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { address } = useAccount();

  if (!ready) {
    return (
      <div className="h-10 w-32 animate-pulse rounded-md border border-arena-border bg-arena-surface" />
    );
  }

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={login}
        className="rounded-md bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg hover:bg-arena-accent/90"
      >
        Connect
      </button>
    );
  }

  const label = address ? shortenAddress(address) : (user?.email?.address ?? "Account");

  return (
    <div className="flex items-center gap-3">
      <span className="rounded-md border border-arena-border bg-arena-surface px-3 py-2 text-sm text-arena-text">
        {label}
      </span>
      <button
        type="button"
        onClick={logout}
        className="rounded-md border border-arena-border px-3 py-2 text-sm text-arena-muted hover:text-arena-text"
      >
        Disconnect
      </button>
    </div>
  );
}
