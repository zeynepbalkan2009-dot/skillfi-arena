"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

type CohortUser = { username: string; display_name: string | null; region: string; wallet_address: string | null };
type Enrollment = { id: string; status: string; created_at: string; review_note: string; user: CohortUser | null };
type Counts = Record<"applied" | "active" | "completed" | "withdrawn" | "rejected", number>;
type GameMetric = { completions: number; averageScore: number | null; averageRating: number | null };

export function PilotAdminClient() {
  const { authenticated, getAccessToken, login } = usePrivy();
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [counts, setCounts] = useState<Counts>({ applied: 0, active: 0, completed: 0, withdrawn: 0, rejected: 0 });
  const [gameSummary, setGameSummary] = useState<Record<string, GameMetric>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | keyof Counts>("all");
  const [query, setQuery] = useState("");

  const tokenHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = authenticated ? await getAccessToken() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [authenticated, getAccessToken]);

  const load = useCallback(async () => {
    if (!authenticated) { setLoading(false); return; }
    const response = await fetch("/api/admin/pilot", { headers: await tokenHeaders(), cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setRows(data.enrollments ?? []); setCounts(data.counts ?? {}); setGameSummary(data.gameSummary ?? {}); }
    else setMessage(response.status === 403 ? "This account is not authorized for pilot administration." : data.error ?? "Could not load cohort.");
    setLoading(false);
  }, [authenticated, tokenHeaders]);

  useEffect(() => { void load(); }, [load]);

  const visibleRows = useMemo(() => rows.filter((row) => {
    if (filter !== "all" && row.status !== filter) return false;
    const haystack = `${row.user?.username ?? ""} ${row.user?.display_name ?? ""} ${row.user?.region ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [filter, query, rows]);

  function exportCsv() {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const lines = ["username,display_name,region,status,wallet_linked,applied_at,review_note", ...visibleRows.map((row) => [row.user?.username ?? "", row.user?.display_name ?? "", row.user?.region ?? "", row.status, row.user?.wallet_address ? "yes" : "no", row.created_at, row.review_note ?? ""].map((value) => quote(value)).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `skillfi-pilot-cohort-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  async function decide(enrollmentId: string, decision: "active" | "rejected" | "completed") {
    const note = decision === "active" ? "Accepted into controlled testnet cohort" : decision === "rejected" ? "Not selected for current cohort" : "Pilot checklist completed";
    setBusy(enrollmentId); setMessage("");
    const response = await fetch("/api/admin/pilot", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await tokenHeaders()) }, body: JSON.stringify({ enrollmentId, decision, note }) });
    const data = await response.json().catch(() => ({}));
    setBusy(null); setMessage(response.ok ? `Enrollment marked ${decision}.` : data.error ?? "Update failed.");
    if (response.ok) await load();
  }

  if (!authenticated) return <main className="mx-auto max-w-5xl px-5 py-12"><div className="rounded-3xl border border-white/10 bg-white/[.03] p-8 text-center"><h1 className="font-display text-3xl font-bold">Pilot Cohort Admin</h1><p className="mt-3 text-sm text-slate-500">Sign in with an authorized administrator account.</p><button onClick={login} className="mt-6 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-[#071014]">SIGN IN</button></div></main>;

  return <main className="mx-auto max-w-6xl px-5 py-9"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Controlled testnet operations</p><h1 className="mt-2 font-display text-4xl font-black">Pilot Cohort</h1><p className="mt-2 text-sm text-slate-500">Review applicants and keep active participation within the 100-player cap.</p></div><div className="flex flex-wrap gap-2"><Link href="/pilot/runbook" className="rounded-lg border border-amber-300/20 px-4 py-2 text-xs font-bold text-amber-100">SESSION RUNBOOK</Link><button onClick={exportCsv} disabled={!visibleRows.length} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold disabled:opacity-40">EXPORT CSV</button><button onClick={() => void load()} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold">REFRESH</button></div></div>
    <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-5">{Object.entries(counts).map(([status, count]) => <div key={status} className="rounded-xl border border-white/7 bg-white/[.025] p-4"><p className="font-display text-2xl font-bold text-white">{count}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{status}</p></div>)}</div>
    <section className="mt-6"><h2 className="font-display text-xl font-bold">Five-game coverage</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(gameSummary).map(([slug, metric]) => <div key={slug} className="rounded-xl border border-white/7 bg-white/[.025] p-4"><p className="text-xs font-bold capitalize text-white">{slug.replaceAll("-", " ")}</p><p className="mt-3 text-2xl font-bold text-cyan-200">{metric.completions}</p><p className="text-[10px] uppercase text-slate-600">completions</p><p className="mt-2 text-xs text-slate-500">Score {metric.averageScore ?? "—"}% · Rating {metric.averageRating ?? "—"}/5</p></div>)}</div></section>
    <div className="mt-5 overflow-hidden rounded-full bg-white/5"><div className="h-2 bg-gradient-to-r from-cyan-300 to-indigo-400 transition-all" style={{ width: `${Math.min(counts.active, 100)}%` }}/></div><p className="mt-2 text-right text-xs text-slate-600">{100 - counts.active} active cohort slots remaining</p>
    {message && <p role="status" className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[.06] px-4 py-3 text-sm text-amber-200">{message}</p>}
    <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_220px]"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player or region" aria-label="Search pilot cohort" className="rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm outline-none focus:border-cyan-300/40"/><select value={filter} onChange={(event) => setFilter(event.target.value as "all" | keyof Counts)} aria-label="Filter pilot status" className="rounded-xl border border-white/10 bg-[#0b0e14] px-4 py-3 text-sm"><option value="all">All statuses</option>{Object.keys(counts).map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
    <section className="mt-4 space-y-3">{loading ? <p className="text-sm text-slate-500">Loading cohort…</p> : visibleRows.length ? visibleRows.map((row) => <article key={row.id} className="grid gap-4 rounded-2xl border border-white/7 bg-white/[.025] p-5 md:grid-cols-[1fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-3"><h2 className="font-bold text-white">{row.user?.display_name || row.user?.username || "Unknown player"}</h2><span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black uppercase text-cyan-200">{row.status}</span></div><p className="mt-2 text-xs text-slate-500">{row.user?.region ?? "—"} · Applied {new Date(row.created_at).toLocaleDateString()} · {row.user?.wallet_address ? "wallet linked" : "wallet pending"}</p>{row.review_note && <p className="mt-2 text-sm text-slate-400">{row.review_note}</p>}</div><div className="flex flex-wrap gap-2">{row.status === "applied" && <><Action disabled={busy === row.id} onClick={() => void decide(row.id, "active")}>ACTIVATE</Action><Action disabled={busy === row.id} onClick={() => void decide(row.id, "rejected")} muted>REJECT</Action></>}{row.status === "active" && <Action disabled={busy === row.id} onClick={() => void decide(row.id, "completed")}>COMPLETE</Action>}</div></article>) : <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">No pilot applications match this view.</div>}</section>
  </main>;
}

function Action({ children, disabled, muted, onClick }: { children: React.ReactNode; disabled: boolean; muted?: boolean; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} className={`rounded-lg px-3 py-2 text-[10px] font-black disabled:opacity-40 ${muted ? "border border-white/10 text-slate-400" : "bg-cyan-300 text-[#071014]"}`}>{children}</button>;
}
