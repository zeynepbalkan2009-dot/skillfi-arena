"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";

export function CancelMatchButton({ matchId }: { matchId: string }) {
  const { getAccessToken } = usePrivy();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelMatch() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/matches/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Cancellation failed");
      setConfirming(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cancellation failed");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-arena-border px-4 py-2 text-sm text-arena-muted transition hover:border-arena-danger/50 hover:text-arena-danger"
      >
        Cancel & refund
      </button>
    );
  }

  return (
    <div className="max-w-56 space-y-2 text-right">
      <p className="text-xs leading-5 text-arena-muted">Cancel this unstarted match and refund deposited funds?</p>
      <div className="flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="px-2 py-1 text-xs text-arena-muted">
          Keep
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={cancelMatch}
          className="rounded-md bg-arena-danger px-3 py-1.5 text-xs font-semibold text-arena-bg disabled:opacity-50"
        >
          {busy ? "Refunding…" : "Confirm refund"}
        </button>
      </div>
      {error && <p className="text-xs text-arena-danger">{error}</p>}
    </div>
  );
}
