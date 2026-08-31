"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { GameShell } from "@/components/GameShell";
import { ChallengeCard } from "@/components/ChallengeCard";
import { CreateChallengeModal } from "@/components/CreateChallengeModal";
import { OnboardingCard } from "@/components/OnboardingCard";
import { useSkillFiUser } from "@/components/AuthSync";
import type { Game, MatchWithRelations } from "@/lib/types";
import { SETTLEMENT_ASSET_LABEL } from "@/lib/contracts";

export function ChallengeHubClient({ initialMatches, games }: { initialMatches: MatchWithRelations[]; games: Game[] }) {
  const { authenticated, getAccessToken } = usePrivy();
  const { profile, loading, needsProfile } = useSkillFiUser();
  const [matches, setMatches] = useState(initialMatches);
  const [modalOpen, setModalOpen] = useState(false);
  const [pilotStatus, setPilotStatus] = useState<"signed_out" | "none" | "applied" | "active" | "completed" | "withdrawn" | "rejected" | "loading">("loading");
  useEffect(() => { setMatches(initialMatches); }, [initialMatches]);
  const loadPilotStatus = useCallback(async () => {
    if (!authenticated) { setPilotStatus("signed_out"); return; }
    const token = await getAccessToken();
    if (!token) { setPilotStatus("signed_out"); return; }
    const response = await fetch("/api/pilot/enroll", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    setPilotStatus(response.ok ? (data.enrollment?.status ?? "none") : "none");
  }, [authenticated, getAccessToken]);
  useEffect(() => { if (!loading) void loadPilotStatus(); }, [loading, loadPilotStatus]);
  const sorted = useMemo(() => [...matches].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()), [matches]);
  const pilotActive = pilotStatus === "active";

  return <GameShell><main className="mx-auto max-w-[1480px] px-4 py-7 sm:px-7 lg:py-9"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.22em] text-rose-300"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-300"/>Live combat queue</div><h1 className="mt-2 font-display text-4xl font-black uppercase italic text-white sm:text-5xl">Challenge Arena</h1><p className="mt-2 text-sm text-slate-500">Pick a game. Run a controlled testnet match. Prove who wins.</p></div><button onClick={()=>setModalOpen(true)} disabled={!authenticated||loading||!pilotActive} title={pilotActive ? "Create a pilot challenge" : "Active beta access is required"} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-[#071015] disabled:cursor-not-allowed disabled:opacity-40">+ CREATE CHALLENGE</button></div>
  <PilotAccessBanner status={pilotStatus}/>
  <section className="mt-8 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-white/7 bg-white/[.035] p-5"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Open fights</p><p className="mt-2 font-display text-3xl font-bold">{sorted.length}</p></div><div className="rounded-2xl border border-white/7 bg-white/[.035] p-5"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Network</p><p className="mt-2 font-display text-3xl font-bold text-cyan-300">TESTNET</p></div><div className="rounded-2xl border border-white/7 bg-white/[.035] p-5"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Pilot asset</p><p className="mt-2 font-display text-2xl font-bold">{SETTLEMENT_ASSET_LABEL}</p></div></section>
  <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]"><section className="rounded-3xl border border-white/7 bg-white/[.025] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-2xl font-bold">Open lobbies</h2><p className="mt-1 text-xs text-slate-600">Verified results · Testnet-only sessions</p></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-300">MATCHMAKING ONLINE</span></div>{needsProfile?<OnboardingCard/>:sorted.length===0?<div className="rounded-2xl border border-dashed border-white/10 py-20 text-center"><p className="font-display text-2xl font-bold text-white">The arena is quiet</p><p className="mt-2 text-sm text-slate-500">Be the first active pilot player to open a challenge.</p></div>:<div className="space-y-3">{sorted.map(match=><ChallengeCard key={match.id} match={match} isOwnChallenge={match.player_a_id===profile?.id} canJoin={pilotActive}/>)}</div>}</section><aside className="rounded-3xl border border-indigo-400/15 bg-indigo-500/[.055] p-5"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-indigo-300">Guild mission preview</p><h2 className="mt-2 font-display text-2xl font-bold">Voidrunners Hunt</h2><p className="mt-3 text-sm leading-6 text-slate-500">A non-financial test mission: win 3 verified matches against a rival guild before Sunday.</p><div className="mt-6 rounded-xl bg-black/20 p-4"><p className="text-xs text-slate-600">PILOT RECOGNITION</p><p className="mt-1 font-display text-2xl font-bold text-white">Guild badge</p></div><div className="mt-4 text-xs text-slate-500">Demo proposal · 16/24 wins simulated</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full w-2/3 bg-indigo-400"/></div></aside></div></main><CreateChallengeModal open={modalOpen} onClose={()=>setModalOpen(false)} games={games} currentUser={profile}/></GameShell>;
}

function PilotAccessBanner({ status }: { status: "signed_out" | "none" | "applied" | "active" | "completed" | "withdrawn" | "rejected" | "loading" }) {
  if (status === "active") return <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[.06] p-4"><div><p className="text-xs font-black uppercase tracking-wider text-emerald-300">Beta access active</p><p className="mt-1 text-sm text-slate-400">Your account can create and join the five controlled pilot games.</p></div><Link href="/pilot/games" className="text-xs font-bold text-emerald-200">Practice games →</Link></div>;
  const copy = status === "applied" ? "Your application is awaiting manual review." : status === "loading" ? "Checking controlled-beta access…" : status === "rejected" ? "Your application was not selected for this cohort." : status === "completed" ? "Your current pilot session has been completed." : status === "withdrawn" ? "Your pilot application is withdrawn." : status === "signed_out" ? "Sign in and apply before entering a pilot match." : "Apply for the controlled beta before entering a pilot match.";
  return <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[.05] p-4"><div><p className="text-xs font-black uppercase tracking-wider text-amber-200">Pilot arena locked</p><p className="mt-1 text-sm text-slate-400">{copy}</p></div><Link href="/pilot" className="rounded-lg border border-amber-200/20 px-4 py-2 text-xs font-bold text-amber-100">VIEW PILOT ACCESS</Link></div>;
}
