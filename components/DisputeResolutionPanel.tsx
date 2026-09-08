"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

type Player = { id: string; username: string; display_name: string | null; wallet_address: string | null };
type Dispute = { id: string; smart_contract_match_id: string; created_at: string; player_a_id: string; player_b_id: string; player_a: Player | null; player_b: Player | null };

export function DisputeResolutionPanel() {
  const { authenticated, getAccessToken } = usePrivy();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const headers = useCallback(async (): Promise<Record<string, string>> => {
    const token = authenticated ? await getAccessToken() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [authenticated, getAccessToken]);
  const load = useCallback(async () => {
    if (!authenticated) return;
    const response = await fetch("/api/admin/disputes/readiness", { headers: await headers(), cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) { setDisputes(body.disputes ?? []); setReady(Boolean(body.ready)); }
  }, [authenticated, headers]);
  useEffect(() => { void load(); }, [load]);

  async function resolve(match: Dispute, winner: Player) {
    const label = winner.display_name || winner.username;
    if (!window.confirm(`Resolve this dispute in favor of ${label}? This sends an irreversible Arc Testnet transaction.`)) return;
    setBusy(match.id); setMessage("");
    const response = await fetch("/api/admin/disputes/resolve", { method: "POST", headers: { "Content-Type": "application/json", ...(await headers()) }, body: JSON.stringify({ matchId: match.id, winnerId: winner.id, confirmation: "RESOLVE_DISPUTE" }) });
    const body = await response.json().catch(() => ({}));
    setBusy(null); setMessage(response.ok ? `Dispute resolved. Transaction ${body.txHash}` : body.error ?? "Resolution failed.");
    if (response.ok) await load();
  }

  if (!authenticated) return null;
  return <section className="mx-auto mt-6 max-w-6xl px-5"><div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">Arbitration queue</p><h2 className="mt-1 font-display text-xl font-bold">Pending disputes</h2></div><span className={`text-xs font-bold ${ready ? "text-emerald-300" : "text-rose-300"}`}>{ready ? "ARBITER READY" : "ARBITER UNAVAILABLE"}</span></div>
    {message && <p role="status" className="mt-4 break-all text-sm text-amber-100">{message}</p>}
    <div className="mt-4 space-y-3">{disputes.length ? disputes.map((match) => <article key={match.id} className="rounded-xl border border-white/7 p-4"><p className="font-mono text-xs text-slate-500">Match {match.smart_contract_match_id}</p><div className="mt-3 flex flex-wrap gap-2">{[match.player_a, match.player_b].filter((player): player is Player => Boolean(player)).map((player) => <button key={player.id} disabled={!ready || busy === match.id || !player.wallet_address} onClick={() => void resolve(match, player)} className="rounded-lg border border-amber-200/20 px-3 py-2 text-xs font-bold text-amber-100 disabled:opacity-40">AWARD TO {player.display_name || player.username}</button>)}</div></article>) : <p className="text-sm text-slate-500">No disputes are waiting for arbitration.</p>}</div>
  </div></section>;
}
