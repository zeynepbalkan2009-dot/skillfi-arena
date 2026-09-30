
"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSkillFiUser } from "@/components/AuthSync";
import { GameShell } from "@/components/GameShell";
import { OnboardingCard } from "@/components/OnboardingCard";
import { WalletConnect } from "@/components/WalletConnect";
import type { MatchAuditEvent, MatchWithRelations, PlayerProfile } from "@/lib/types";

export function ProfileClient() {
  const { authenticated, getAccessToken } = usePrivy();
  const { profile, needsProfile } = useSkillFiUser();
  const [draft, setDraft] = useState({ username: "", displayName: "", avatarUrl: "" });
  const [savedProfile, setSavedProfile] = useState<PlayerProfile | null>(profile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchWithRelations[]>([]);
  const [auditEvents, setAuditEvents] = useState<MatchAuditEvent[]>([]);

  useEffect(() => {
    if (!profile) return;
    setSavedProfile(profile);
    setDraft({ username: profile.username, displayName: profile.display_name ?? "", avatarUrl: profile.avatar_url ?? "" });
  }, [profile]);

  useEffect(() => {
    if (!profile?.id) { setMatches([]); setAuditEvents([]); return; }
    let active = true;
    async function loadMatches() {
      const token = await getAccessToken();
      if (!token) return;
      const response = await fetch("/api/profile/matches", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (active && response.ok) { setMatches(body.matches ?? []); setAuditEvents(body.events ?? []); }
    }
    void loadMatches();
    return () => { active = false; };
  }, [getAccessToken, profile?.id]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No Privy access token available.");
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(draft) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Profile update failed.");
      setSavedProfile(body.user); setMessage("Profile saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Profile update failed."); }
    finally { setSaving(false); }
  }

  const completed = matches.filter((m) => m.status === "completed").length;
  const wins = savedProfile?.wins ?? matches.filter((m) => m.status === "completed" && m.winner_id === savedProfile?.id).length;
  const losses = savedProfile?.losses ?? Math.max(0, completed - wins);
  const played = savedProfile?.matches_played ?? Math.max(completed, wins + losses);
  const xp = Math.min(1000, played * 100 + wins * 150);
  const level = Math.floor(xp / 250) + 1;
  const progress = xp % 250;
  const disputed = matches.filter((m) => m.status === "disputed");

  return (
    <GameShell>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-arena-accent">Season 00 / Player station</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em] text-arena-text sm:text-6xl">Progression</h1>
          </div>
          <WalletConnect />
        </div>

        {!authenticated ? (
          <section className="border border-arena-border bg-arena-surface p-7 sm:p-9">
            <p className="font-mono text-xs text-arena-accent">PLAYER ID // LOCKED</p>
            <h2 className="mt-4 font-display text-3xl font-semibold text-arena-text">Connect to load your station.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-arena-muted">Your profile, match history and Season 00 progression are tied to your authenticated player record.</p>
          </section>
        ) : needsProfile ? <OnboardingCard /> : (
          <>
            <section className="grid gap-6 border-b border-arena-border pb-8 lg:grid-cols-[1.4fr_.6fr]">
              <div className="border border-arena-border bg-arena-surface p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div>
                    <p className="font-mono text-[10px] text-arena-muted">PLAYER // SEASON 00</p>
                    <h2 className="mt-3 font-display text-3xl font-semibold text-arena-text">{savedProfile?.display_name || savedProfile?.username}</h2>
                    <p className="mt-1 text-sm text-arena-muted">@{savedProfile?.username} · {savedProfile?.region}</p>
                  </div>
                  <div className="text-right"><p className="text-[10px] uppercase tracking-[.18em] text-arena-muted">Rank</p><p className="mt-1 font-display text-4xl text-arena-accent">LVL {level}</p></div>
                </div>
                <div className="mt-8">
                  <div className="mb-2 flex justify-between text-[11px] font-mono text-arena-muted"><span>SEASON XP</span><span>{progress} / 250</span></div>
                  <div className="h-2 bg-[#e7ecea]"><div className="h-2 bg-arena-accent transition-all" style={{ width: `${(progress / 250) * 100}%` }} /></div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[.14em] text-arena-muted">
                  <span className="border border-arena-border px-2 py-1">Founders' Pilot</span><span className="border border-arena-border px-2 py-1">Controlled shard</span>
                </div>
              </div>
              <div className="grid grid-cols-2 border border-arena-border bg-arena-surface">
                {[['Matches', played], ['Wins', wins], ['Losses', losses], ['ELO', savedProfile?.elo_rating ?? 1000]].map(([label,value]) => <div key={label} className="border-b border-r border-arena-border p-5 last:border-r-0"><p className="text-[10px] uppercase tracking-[.16em] text-arena-muted">{label}</p><p className="mt-2 font-display text-2xl text-arena-text">{value}</p></div>)}
              </div>
            </section>

            <section className="grid gap-8 py-10 lg:grid-cols-[1.1fr_.9fr]">
              <div>
                <div className="flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-arena-muted">Season route</p><h2 className="mt-2 font-display text-2xl font-semibold text-arena-text">Milestones</h2></div><Link href="/games" className="text-xs font-semibold text-arena-accent hover:underline">Open Game Library →</Link></div>
                <div className="mt-6 border-l-2 border-arena-border pl-5">
                  {[['01','Station online','Player profile connected'],['02','First match','Complete your first verified match'],['03','Season regular','Reach 5 completed matches'],['04','Arena veteran','Reach 10 completed matches']].map(([n,title,copy],i) => { const done = i===0 ? true : completed >= [1,1,5,10][i]; return <div key={n} className="relative pb-7 last:pb-0"><span className={`absolute -left-[29px] top-0 h-3 w-3 rounded-full border-2 ${done ? 'border-arena-accent bg-arena-accent' : 'border-arena-border bg-arena-bg'}`} /><p className="font-mono text-[10px] text-arena-muted">{n}</p><h3 className="mt-1 font-semibold text-arena-text">{title}</h3><p className="mt-1 text-sm text-arena-muted">{copy}</p></div>; })}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[.18em] text-arena-muted">Recent runs</p><h2 className="mt-2 font-display text-2xl font-semibold text-arena-text">Match history</h2>
                {disputed.length > 0 && <div className="mt-5 border border-[#d8caa5] bg-[#f7f5ef] p-4 text-sm text-[#79652e]"><b>{disputed.length}</b> match{disputed.length === 1 ? '' : 'es'} under review. Payout is paused while the result is reviewed.</div>}
                <div className="mt-5 space-y-2">
                  {matches.length === 0 ? <div className="border border-dashed border-arena-border p-5 text-sm text-arena-muted">No matches recorded yet. Your first run will appear here.</div> : matches.slice(0,6).map((match) => { const opponent = match.player_a_id === savedProfile?.id ? match.player_b : match.player_a; const outcome = match.status !== 'completed' ? match.status : match.winner_id === savedProfile?.id ? 'won' : 'lost'; return <Link key={match.id} href={`/matches/${match.id}`} className="flex items-center justify-between gap-4 border border-arena-border bg-arena-surface p-4 hover:border-arena-accent"><div><p className="font-semibold text-arena-text">{match.game?.name ?? 'SkillFi Match'}</p><p className="mt-1 text-xs text-arena-muted">vs {opponent?.display_name ?? opponent?.username ?? 'Waiting for opponent'}</p></div><span className="text-xs font-semibold uppercase tracking-wide text-arena-accent">{outcome.replaceAll('_',' ')}</span></Link>; })}
                </div>
              </div>
            </section>

            <section className="border-t border-arena-border pt-8">
              <details className="group"><summary className="cursor-pointer list-none text-sm font-semibold text-arena-text">Edit player identity <span className="ml-2 text-arena-muted group-open:hidden">+</span><span className="ml-2 text-arena-muted hidden group-open:inline">−</span></summary>
                <form onSubmit={saveProfile} className="mt-5 grid gap-4 border border-arena-border bg-arena-surface p-5 sm:grid-cols-3">
                  <input aria-label="Username" value={draft.username} onChange={e=>setDraft(v=>({...v,username:e.target.value}))} className="border border-arena-border bg-arena-bg px-3 py-2 text-sm text-arena-text focus:border-arena-accent focus:outline-none" />
                  <input aria-label="Display name" value={draft.displayName} onChange={e=>setDraft(v=>({...v,displayName:e.target.value}))} className="border border-arena-border bg-arena-bg px-3 py-2 text-sm text-arena-text focus:border-arena-accent focus:outline-none" />
                  <button disabled={saving || !draft.username} className="bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg disabled:opacity-50">{saving ? 'Saving...' : 'Save identity'}</button>
                  {message && <p className="text-xs text-arena-muted sm:col-span-3">{message}</p>}
                </form>
              </details>
            </section>
          </>
        )}
      </main>
    </GameShell>
  );
}
