"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { GameShell } from "@/components/GameShell";
import { ChallengeCard } from "@/components/ChallengeCard";
import { CreateChallengeModal } from "@/components/CreateChallengeModal";
import { OnboardingCard } from "@/components/OnboardingCard";
import { useSkillFiUser } from "@/components/AuthSync";
import type { Game, MatchWithRelations } from "@/lib/types";

export function ChallengeHubClient({ initialMatches, games }: { initialMatches: MatchWithRelations[]; games: Game[] }) {
  const { authenticated } = usePrivy();
  const { profile, loading, needsProfile } = useSkillFiUser();
  const [matches, setMatches] = useState(initialMatches);
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => { setMatches(initialMatches); }, [initialMatches]);
  const sorted = useMemo(() => [...matches].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()), [matches]);

  return <GameShell><main className="mx-auto max-w-[1480px] px-4 py-7 sm:px-7 lg:py-9"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.22em] text-rose-300"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-300"/>Live combat queue</div><h1 className="mt-2 font-display text-4xl font-black uppercase italic text-white sm:text-5xl">Challenge Arena</h1><p className="mt-2 text-sm text-slate-500">Pick a game. Lock equal USDC stakes. Prove who wins.</p></div><button onClick={()=>setModalOpen(true)} disabled={!authenticated||loading} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-[#071015] disabled:opacity-40">+ CREATE CHALLENGE</button></div>
  <section className="mt-8 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-white/7 bg-white/[.035] p-5"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Open fights</p><p className="mt-2 font-display text-3xl font-bold">{sorted.length}</p></div><div className="rounded-2xl border border-white/7 bg-white/[.035] p-5"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Network</p><p className="mt-2 font-display text-3xl font-bold text-cyan-300">ARC</p></div><div className="rounded-2xl border border-white/7 bg-white/[.035] p-5"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Settlement asset</p><p className="mt-2 font-display text-3xl font-bold">USDC</p></div></section>
  <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]"><section className="rounded-3xl border border-white/7 bg-white/[.025] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-2xl font-bold">Open lobbies</h2><p className="mt-1 text-xs text-slate-600">Verified entry fees · Equal stakes</p></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-300">MATCHMAKING ONLINE</span></div>{needsProfile?<OnboardingCard/>:sorted.length===0?<div className="rounded-2xl border border-dashed border-white/10 py-20 text-center"><p className="font-display text-2xl font-bold text-white">The arena is quiet</p><p className="mt-2 text-sm text-slate-500">Be the first player to open a challenge.</p></div>:<div className="space-y-3">{sorted.map(match=><ChallengeCard key={match.id} match={match} isOwnChallenge={match.player_a_id===profile?.id}/>)}</div>}</section><aside className="rounded-3xl border border-indigo-400/15 bg-indigo-500/[.055] p-5"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-indigo-300">Guild bounty</p><h2 className="mt-2 font-display text-2xl font-bold">Voidrunners Hunt</h2><p className="mt-3 text-sm leading-6 text-slate-500">Win 3 verified matches against the rival guild before Sunday.</p><div className="mt-6 rounded-xl bg-black/20 p-4"><p className="text-xs text-slate-600">REWARD POOL</p><p className="mt-1 font-display text-3xl font-bold text-white">180 USDC</p></div><div className="mt-4 text-xs text-slate-500">Community proposal #18 · 16/24 wins completed</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full w-2/3 bg-indigo-400"/></div></aside></div></main><CreateChallengeModal open={modalOpen} onClose={()=>setModalOpen(false)} games={games} currentUser={profile}/></GameShell>;
}
