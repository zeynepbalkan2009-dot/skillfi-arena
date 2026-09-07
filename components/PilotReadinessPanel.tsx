"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

type Readiness = {
  ready: boolean;
  checkedAt: string;
  checks: Record<string, boolean>;
  metrics: { publishedGames: number; activePlayers: number; capacity: number; pendingDisputes: number; pendingStudioReviews: number };
};

const labels: Record<string, string> = {
  fiveGamesPublished: "Five games published",
  cohortWithinCapacity: "Cohort within capacity",
  escrowDeployed: "Arc escrow deployed",
  operatorReady: "Operator role ready",
  arbiterReady: "Arbiter role ready",
};

export function PilotReadinessPanel() {
  const { authenticated, getAccessToken } = usePrivy();
  const [data, setData] = useState<Readiness | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!authenticated) return;
    const token = await getAccessToken();
    const response = await fetch("/api/admin/readiness", { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) { setData(body); setError(""); }
    else setError(body.error ?? "Readiness could not be checked.");
  }, [authenticated, getAccessToken]);

  useEffect(() => { void load(); }, [load]);
  if (!authenticated) return null;

  return <section className="mt-7 rounded-2xl border border-white/10 bg-white/[.025] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Launch readiness</p><h2 className="mt-1 font-display text-xl font-bold">Controlled pilot gate</h2></div><button onClick={() => void load()} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold">RECHECK</button></div>
    {error ? <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p> : data ? <>
      <p className={`mt-4 text-sm font-bold ${data.ready ? "text-emerald-300" : "text-amber-200"}`}>{data.ready ? "READY FOR CONTROLLED TESTING" : "ACTION REQUIRED BEFORE TESTING"}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-5">{Object.entries(data.checks).map(([key, ok]) => <div key={key} className="rounded-lg border border-white/7 p-3"><span className={ok ? "text-emerald-300" : "text-rose-300"}>{ok ? "PASS" : "FAIL"}</span><p className="mt-1 text-xs text-slate-400">{labels[key] ?? key}</p></div>)}</div>
      <p className="mt-4 text-xs text-slate-500">{data.metrics.publishedGames} published games · {data.metrics.activePlayers}/{data.metrics.capacity} active players · {data.metrics.pendingDisputes} pending disputes · {data.metrics.pendingStudioReviews} studio reviews</p>
    </> : <p className="mt-4 text-sm text-slate-500">Checking production dependencies…</p>}
  </section>;
}
