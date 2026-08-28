"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { Game, Studio } from "@/lib/types";

export function StudioReviewClient() {
  const { getAccessToken } = usePrivy();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    const response = await fetch("/api/admin/studios", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Could not load review queue");
    setStudios(body.studios ?? []); setGames(body.games ?? []);
  }, [getAccessToken]);
  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, [load]);

  async function decide(payload: { studioId?: string; gameId?: string; decision: string }) {
    setBusy(true); setError(null);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/admin/studios", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Review update failed");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Review update failed"); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-arena-bg px-5 py-8 text-arena-text"><div className="mx-auto max-w-5xl">
    <Link href="/studio" className="text-sm text-arena-muted hover:text-white">Back to studio portal</Link>
    <h1 className="mt-8 font-display text-4xl font-bold">Studio Review Queue</h1>
    <p className="mt-2 text-arena-muted">Approve paid studios, move submitted games into sandbox, and publish only after integration validation.</p>
    {error && <p className="mt-5 rounded-md border border-arena-danger/40 bg-arena-danger/10 p-4 text-arena-danger">{error}</p>}
    <div className="mt-8 space-y-6">{studios.map((studio) => <section key={studio.id} className="rounded-xl border border-arena-border bg-arena-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl font-bold">{studio.name}</h2><p className="text-sm capitalize text-arena-muted">{studio.status.replaceAll("_", " ")}</p></div><div className="flex gap-2">{studio.status === "pending_review" && <><button disabled={busy} onClick={() => decide({ studioId: studio.id, decision: "approved" })} className="rounded-md bg-arena-win px-3 py-2 text-xs font-bold text-arena-bg">Approve studio</button><button disabled={busy} onClick={() => decide({ studioId: studio.id, decision: "rejected" })} className="rounded-md border border-arena-danger/40 px-3 py-2 text-xs text-arena-danger">Reject</button></>}</div></div>
      <div className="mt-5 space-y-3">{games.filter((game) => game.studio_id === studio.id).map((game) => <div key={game.id} className="rounded-lg border border-arena-border bg-arena-bg p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{game.name}</p><p className="mt-1 text-sm text-arena-muted">{game.description}</p><p className="mt-2 text-xs capitalize text-arena-accent">{game.integration_status}</p></div>{game.integration_status === "submitted" && <button disabled={busy} onClick={() => decide({ gameId: game.id, decision: "sandbox" })} className="h-fit rounded-md border border-arena-accent-dim px-3 py-2 text-xs text-arena-accent">Move to sandbox</button>}{game.integration_status === "sandbox" && <button disabled={busy || studio.status !== "approved"} onClick={() => decide({ gameId: game.id, decision: "published" })} className="h-fit rounded-md bg-arena-accent px-3 py-2 text-xs font-bold text-arena-bg disabled:opacity-40">Publish game</button>}</div></div>)}</div>
    </section>)}</div>
  </div></main>;
}
