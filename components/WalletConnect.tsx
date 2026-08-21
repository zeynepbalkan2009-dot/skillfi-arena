"use client";

import { usePrivy } from "@privy-io/react-auth";

export function WalletConnect() {
  const { ready, authenticated, login, logout } = usePrivy();

  if (!ready) return <span className="text-sm text-arena-muted">Loading…</span>;
  if (!authenticated) return <button type="button" onClick={login} className="rounded-md bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg">Connect Wallet</button>;
  return <button type="button" onClick={logout} className="rounded-md border border-arena-border px-4 py-2 text-sm text-arena-text">Disconnect</button>;
}
