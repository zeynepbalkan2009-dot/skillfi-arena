"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSkillFiUser } from "@/components/AuthSync";
import { GameShell } from "@/components/GameShell";
import { OnboardingCard } from "@/components/OnboardingCard";
import { WalletConnect } from "@/components/WalletConnect";

type MatchRecord = {
  id: string;
  game?: { name?: string | null } | null;
  player_a_id: string;
  player_b_id: string | null;
  player_a?: { username?: string | null; display_name?: string | null } | null;
  player_b?: { username?: string | null; display_name?: string | null } | null;
  status: string;
  winner_id: string | null;
};

export function ProfileClient() {
  const { authenticated, getAccessToken } = usePrivy();
  const { profile, needsProfile } = useSkillFiUser();
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [draft, setDraft] = useState({ username: "", displayName: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!profile) return;
    setDraft({ username: profile.username, displayName: profile.display_name ?? "" });
  }, [profile]);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    void getAccessToken().then(async (token) => {
      if (!token) return;
      const response = await fetch("/api/profile/matches", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok || cancelled) return;
      const body = await response.json();
      if (!cancelled) setMatches(Array.isArray(body.matches) ? body.matches : []);
    });
    return () => { cancelled = true; };
  }, [getAccessToken, profile?.id]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No authenticated session.");
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Profile update failed.");
      setMessage("Identity saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profile update failed.");
    } finally {
      setSaving(false);
    }
  }

  const completed = matches.filter((match) => match.status === "completed").length;
  const wins = profile?.wins ?? matches.filter((match) => match.status === "completed" && match.winner_id === profile?.id).length;
  const losses = profile?.losses ?? Math.max(0, completed - wins);
  const played = profile?.matches_played ?? Math.max(completed, wins + losses);
  const xp = played * 100 + wins * 150;
  const level = Math.floor(xp / 250) + 1;
  const levelProgress = xp % 250;

  return (
    <GameShell>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-arena-accent">Season 00 / Player station</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-.03em] text-arena-text sm:text-6xl">Progression</h1>
          </div>
          <WalletConnect />
        </header>

        {!authenticated ? (
          <section className="border border-arena-border bg-arena-surface p-7">
            <p className="font-mono text-xs text-arena-accent">PLAYER ID // LOCKED</p>
            <h2 className="mt-4 font-display text-3xl font-semibold text-arena-text">Connect to load your station.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-arena-muted">Season 00 progression and match history are tied to your authenticated player record.</p>
          </section>
        ) : needsProfile ? <OnboardingCard /> : (
          <>
            <section className="grid gap-6 border-b border-arena-border pb-8 lg:grid-cols-[1.35fr_.65fr]">
              <div className="border border-arena-border bg-arena-surface p-6 sm:p-8">
                <div className="flex flex-wrap justify-between gap-5">
                  <div>
                    <p className="font-mono text-[10px] text-arena-muted">PLAYER // FOUNDERS' PILOT</p>
                    <h2 className="mt-3 font-display text-3xl font-semibold text-arena-text">{profile?.display_name || profile?.username}</h2>
                    <p className="mt-1 text-sm text-arena-muted">@{profile?.username} · {profile?.region}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[.16em] text-arena-muted">Level</p>
                    <p className="mt-1 font-display text-4xl text-arena-accent">{level}</p>
                  </div>
                </div>
                <div className="mt-8">
                  <div className="mb-2 flex justify-between font-mono text-[10px] text-arena-muted"><span>SEASON XP</span><span>{levelProgress} / 250</span></div>
                  <div className="h-2 bg-[#e7ecea]"><div className="h-2 bg-arena-accent" style={{ width: `${(levelProgress / 250) * 100}%` }} /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 border border-arena-border bg-arena-surface">
                {[
                  ["Matches", played],
                  ["Wins", wins],
                  ["Losses", losses],
                  ["ELO", profile?.elo_rating ?? 1000],
                ].map(([label, value]) => (
                  <div key={label} className="border-b border-r border-arena-border p-5">
                    <p className="text-[10px] uppercase tracking-[.16em] text-arena-muted">{label}</p>
                    <p className="mt-2 font-display text-2xl text-arena-text">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-8 py-10 lg:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-[.18em] text-arena-muted">Season route</p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-arena-text">Milestones</h2>
                <div className="mt-6 border-l-2 border-arena-border pl-5">
                  {[
                    ["01", "Station online", "Player profile connected", true],
                    ["02", "First match", "Complete your first verified match", completed >= 1],
                    ["03", "Season regular", "Reach 5 completed matches", completed >= 5],
                    ["04", "Arena veteran", "Reach 10 completed matches", completed >= 10],
                  ].map(([number, title, copy, done]) => (
                    <div key={number} className="relative pb-7 last:pb-0">
                      <span className={`absolute -left-[29px] top-0 h-3 w-3 rounded-full border-2 ${done ? "border-arena-accent bg-arena-accent" : "border-arena-border bg-arena-bg"}`} />
                      <p className="font-mono text-[10px] text-arena-muted">{number}</p>
                      <h3 className="mt-1 font-semibold text-arena-text">{title}</h3>
                      <p className="mt-1 text-sm text-arena-muted">{copy}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-[.18em] text-arena-muted">Recent runs</p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-arena-text">Match history</h2>
                <div className="mt-5 space-y-2">
                  {matches.length === 0 ? (
                    <div className="border border-dashed border-arena-border p-5 text-sm text-arena-muted">No matches recorded yet. Your first run will appear here.</div>
                  ) : matches.slice(0, 6).map((match) => {
                    const opponent = match.player_a_id === profile?.id ? match.player_b : match.player_a;
                    const outcome = match.status === "completed" ? (match.winner_id === profile?.id ? "won" : "lost") : match.status;
                    return (
                      <div key={match.id} className="flex items-center justify-between gap-4 border border-arena-border bg-arena-surface p-4">
                        <div>
                          <p className="font-semibold text-arena-text">{match.game?.name ?? "SkillFi Match"}</p>
                          <p className="mt-1 text-xs text-arena-muted">vs {opponent?.display_name ?? opponent?.username ?? "Opponent"}</p>
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-arena-accent">{outcome.replace(/_/g, " ")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="border-t border-arena-border pt-8">
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-arena-text">Edit player identity</summary>
                <form onSubmit={saveProfile} className="mt-5 grid gap-4 border border-arena-border bg-arena-surface p-5 sm:grid-cols-2">
                  <input aria-label="Username" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} className="border border-arena-border bg-arena-bg px-3 py-2 text-sm text-arena-text focus:border-arena-accent focus:outline-none" />
                  <input aria-label="Display name" value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} className="border border-arena-border bg-arena-bg px-3 py-2 text-sm text-arena-text focus:border-arena-accent focus:outline-none" />
                  <button disabled={saving || !draft.username} className="bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg disabled:opacity-50 sm:col-span-2">{saving ? "Saving..." : "Save identity"}</button>
                  {message && <p className="text-xs text-arena-muted sm:col-span-2">{message}</p>}
                </form>
              </details>
            </section>

            <div className="mt-8 flex flex-wrap gap-4 border-t border-arena-border pt-6 text-sm">
              <Link href="/games" className="font-semibold text-arena-accent hover:underline">Open Game Library →</Link>
              <Link href="/challenges" className="font-semibold text-arena-accent hover:underline">Enter Match Room →</Link>
            </div>
          </>
        )}
      </main>
    </GameShell>
  );
}
