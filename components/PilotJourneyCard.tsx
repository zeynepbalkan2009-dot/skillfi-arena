"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSkillFiUser } from "@/components/AuthSync";

type JourneyState = {
  enrollment: "none" | "applied" | "active" | "completed" | "withdrawn" | "rejected";
  completedGames: number;
};

const initialState: JourneyState = { enrollment: "none", completedGames: 0 };

export function PilotJourneyCard() {
  const { ready, authenticated, getAccessToken, login } = usePrivy();
  const { profile, loading: profileLoading } = useSkillFiUser();
  const [journey, setJourney] = useState<JourneyState>(initialState);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ready || profileLoading) return;
    if (!authenticated) { setJourney(initialState); setLoading(false); return; }
    const token = await getAccessToken();
    if (!token) { setLoading(false); return; }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [enrollmentResponse, runsResponse] = await Promise.all([
        fetch("/api/pilot/enroll", { headers, cache: "no-store" }),
        fetch("/api/pilot/runs", { headers, cache: "no-store" }),
      ]);
      const [enrollmentBody, runsBody] = await Promise.all([
        enrollmentResponse.json().catch(() => ({})),
        runsResponse.json().catch(() => ({})),
      ]);
      setJourney({
        enrollment: enrollmentResponse.ok ? enrollmentBody.enrollment?.status ?? "none" : "none",
        completedGames: runsResponse.ok ? Math.min(5, runsBody.runs?.length ?? 0) : 0,
      });
    } catch {
      setJourney(initialState);
    } finally {
      setLoading(false);
    }
  }, [authenticated, getAccessToken, profileLoading, ready]);

  useEffect(() => { void load(); }, [load]);

  const profileDone = Boolean(profile);
  const accessActive = journey.enrollment === "active";
  const gamesDone = journey.completedGames === 5;
  const completedSteps = Number(profileDone) + Number(accessActive) + Number(gamesDone);

  return <section className="border-b border-arena-border py-8" aria-labelledby="journey-title">
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-lg"><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-arena-accent">Your pilot path</p><h2 id="journey-title" className="mt-2 font-display text-3xl font-semibold text-white">{loading ? "Checking your access…" : authenticated ? `${completedSteps}/3 setup steps complete` : "Sign in to start your pilot setup"}</h2><p className="mt-2 text-sm leading-6 text-arena-muted">Complete your profile, receive controlled-beta approval, then save a result in each of the five practice games.</p></div>
      {!authenticated ? <button type="button" onClick={login} className="min-h-11 bg-arena-accent px-5 text-sm font-semibold text-[#071015]">SIGN IN TO START</button> : <JourneyAction profileDone={profileDone} enrollment={journey.enrollment} gamesDone={gamesDone}/>} 
    </div>
    <ol className="mt-6 grid gap-px overflow-hidden border border-arena-border bg-arena-border md:grid-cols-3">
      <JourneyStep index="01" title="Player profile" detail={profileDone ? "Profile ready" : "Username and region required"} done={profileDone}/>
      <JourneyStep index="02" title="Beta access" detail={accessActive ? "Access active" : journey.enrollment === "applied" ? "Awaiting review" : `Status: ${journey.enrollment}`} done={accessActive}/>
      <JourneyStep index="03" title="Five-game check" detail={`${journey.completedGames}/5 results saved`} done={gamesDone}/>
    </ol>
  </section>;
}

function JourneyAction({ profileDone, enrollment, gamesDone }: { profileDone: boolean; enrollment: JourneyState["enrollment"]; gamesDone: boolean }) {
  if (!profileDone) return <Link href="/profile" className="min-h-11 bg-arena-accent px-5 py-3 text-sm font-semibold text-[#071015]">COMPLETE PROFILE</Link>;
  if (enrollment !== "active") return <Link href="/pilot" className="min-h-11 bg-arena-accent px-5 py-3 text-sm font-semibold text-[#071015]">{enrollment === "applied" ? "VIEW APPLICATION" : "APPLY FOR ACCESS"}</Link>;
  if (!gamesDone) return <Link href="/pilot/games" className="min-h-11 bg-arena-accent px-5 py-3 text-sm font-semibold text-[#071015]">CONTINUE GAME CHECKS</Link>;
  return <Link href="/challenges" className="min-h-11 bg-arena-accent px-5 py-3 text-sm font-semibold text-[#071015]">ENTER CHALLENGE ARENA</Link>;
}

function JourneyStep({ index, title, detail, done }: { index: string; title: string; detail: string; done: boolean }) {
  return <li className="bg-arena-bg p-5"><div className="flex items-center justify-between"><span className="font-mono text-[11px] text-slate-600">{index}</span><span className={done ? "text-emerald-300" : "text-slate-600"} aria-label={done ? "Complete" : "Incomplete"}>{done ? "●" : "○"}</span></div><p className="mt-5 font-display text-lg font-semibold text-white">{title}</p><p className="mt-1 text-sm text-arena-muted">{detail}</p></li>;
}
