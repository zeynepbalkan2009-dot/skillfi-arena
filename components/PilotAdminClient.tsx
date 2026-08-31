"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

type CohortUser = { username: string; display_name: string | null; region: string; wallet_address: string | null };
type Enrollment = { id: string; status: string; created_at: string; review_note: string; user: CohortUser | null };
type Counts = Record<"applied" | "active" | "completed" | "withdrawn" | "rejected", number>;

export function PilotAdminClient() {
  const { authenticated, getAccessToken, login } = usePrivy();
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [counts, setCounts] = useState<Counts>({ applied: 0, active: 0, completed: 0, withdrawn: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const tokenHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = authenticated ? await getAccessToken() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [authenticated, getAccessToken]);

  const load = useCallback(async () => {
    if (!authenticated) { setLoading(false); return; }
    const response = await fetch("/api/admin/pilot", { headers: await tokenHeaders(), cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setRows(data.enrollments ?? []); setCounts(data.counts ?? {}); }
    else setMessage(response.status === 403 ? "This account is not authorized for pilot administration." : data.error ?? "Could not load cohort.");
    setLoading(false);
  }, [authenticated, tokenHeaders]);

  useEffect(() => { void load(); }, [load]);

  async function decide(enrollmentId: string, decision: "active" | "rejected" | "completed") {
    const note = decision === "active" ? "Accepted into controlled testnet cohort" : decision === "rejected" ? "Not selected for current cohort" : "Pilot checklist completed";
    setBusy(enrollmentId); setMessage("");
    const response = await fetch("/api/admin/pilot", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await tokenHeaders()) }, body: JSON.stringify({ enrollmentId, decision, note }) });
    const data = await response.json().catch(() => ({}));
    setBusy(null); setMessage(response.ok ? `Enrollment marked ${decision}.` : data.error ?? "Update failed.");
    if (response.ok) await load();
  }

  if (!authenticated) return <main className="mx-auto max-w-5xl px-5 py-12"><div className="rounded-3xl border border-white/10 bg-white/[.03] p-8 text-center"><h1 className="font-display text-3xl font-bold">Pilot Cohort Admin</h1><p className="mt-3 text-sm text-slate-500">Sign in with an authorized administrator account.</p><button onClick={login} className="mt-6 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-[#071014]">SIGN IN</button></div></main>;

  return <main className="mx-auto max-w-6xl px-5 py-9"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Controlled testnet operations</p><h1 className="mt-2 font-display text-4xl font-black">Pilot Cohort</h1><p className="mt-2 text-sm text-slate-500">Review applicants and keep active participation within the 100-player cap.</p></div><button onClick={() => void load()} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold">REFRESH</button></div>
    <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-5">{Object.entries(counts).map(([status, count]) => <div key={status} className="rounded-xl border border-white/7 bg-white/[.025] p-4"><p className="font-display text-2xl font-bold text-white">{count}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{status}</p></div>)}</div>
    {message && <p role="status" className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[.06] px-4 py-3 text-sm text-amber-200">{message}</p>}
    <section className="mt-6 space-y-3">{loading ? <p className="text-sm text-slate-500">Loading cohort…</p> : rows.length ? rows.map((row) => <article key={row.id} className="grid gap-4 rounded-2xl border border-white/7 bg-white/[.025] p-5 md:grid-cols-[1fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-3"><h2 className="font-bold text-white">{row.user?.display_name || row.user?.username || "Unknown player"}</h2><span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black uppercase text-cyan-200">{row.status}</span></div><p className="mt-2 text-xs text-slate-500">{row.user?.region ?? "—"} · Applied {new Date(row.created_at).toLocaleDateString()} · {row.user?.wallet_address ? "wallet linked" : "wallet pending"}</p>{row.review_note && <p className="mt-2 text-sm text-slate-400">{row.review_note}</p>}</div><div className="flex flex-wrap gap-2">{row.status === "applied" && <><Action disabled={busy === row.id} onClick={() => void decide(row.id, "active")}>ACTIVATE</Action><Action disabled={busy === row.id} onClick={() => void decide(row.id, "rejected")} muted>REJECT</Action></>}{row.status === "active" && <Action disabled={busy === row.id} onClick={() => void decide(row.id, "completed")}>COMPLETE</Action>}</div></article>) : <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">No pilot applications yet.</div>}</section>
  </main>;
}

function Action({ children, disabled, muted, onClick }: { children: React.ReactNode; disabled: boolean; muted?: boolean; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} className={`rounded-lg px-3 py-2 text-[10px] font-black disabled:opacity-40 ${muted ? "border border-white/10 text-slate-400" : "bg-cyan-300 text-[#071014]"}`}>{children}</button>;
}
