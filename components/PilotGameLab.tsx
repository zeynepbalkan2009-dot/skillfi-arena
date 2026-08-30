"use client";

import { useMemo, useState } from "react";
import { createPilotRound, PILOT_GAMES, scorePilotRound, type PilotGameId } from "@/lib/pilotGames";

export function PilotGameLab() {
  const [gameId, setGameId] = useState<PilotGameId>(PILOT_GAMES[0].id);
  const [attempt, setAttempt] = useState(1);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const game = PILOT_GAMES.find((item) => item.id === gameId) ?? PILOT_GAMES[0];
  const round = useMemo(() => createPilotRound(gameId, `pilot-${attempt}`), [attempt, gameId]);
  const score = submitted ? scorePilotRound(round, answer) : null;

  function selectGame(next: PilotGameId) { setGameId(next); setAttempt(1); setAnswer(""); setSubmitted(false); }
  function nextRound() { setAttempt((value) => value + 1); setAnswer(""); setSubmitted(false); }

  return <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
    <nav className="space-y-2" aria-label="Pilot games">{PILOT_GAMES.map((item, index) => <button key={item.id} onClick={() => selectGame(item.id)} className={`w-full rounded-xl border p-4 text-left ${item.id === gameId ? "border-arena-accent bg-arena-accent/10" : "border-arena-border bg-arena-surface"}`}><span className="text-xs text-arena-muted">GAME {index + 1}</span><strong className="mt-1 block text-white">{item.name}</strong><span className="text-xs text-arena-muted">{item.skill}</span></button>)}</nav>
    <section className="rounded-2xl border border-arena-border bg-arena-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-arena-accent">Original skill-only pilot</p><h2 className="mt-2 font-display text-3xl font-bold">{game.name}</h2><p className="mt-1 text-sm text-arena-muted">{game.instructions}</p></div><span className="rounded-full border border-arena-border px-3 py-1 text-xs text-arena-muted">No stake · no prize · test only</span></div>
      <div className="my-6 rounded-xl border border-arena-border bg-arena-bg p-6 text-lg leading-9 text-white">{round.prompt}</div>
      <label className="text-sm font-semibold" htmlFor="pilot-answer">Your answer</label>
      <textarea id="pilot-answer" value={answer} onChange={(event) => { setAnswer(event.target.value); setSubmitted(false); }} className="mt-2 min-h-28 w-full rounded-xl border border-arena-border bg-arena-bg p-4 text-white outline-none focus:border-arena-accent" />
      <div className="mt-4 flex flex-wrap items-center gap-3"><button onClick={() => setSubmitted(true)} disabled={!answer.trim()} className="rounded-lg bg-arena-accent px-5 py-3 font-bold text-arena-bg disabled:opacity-40">Check result</button><button onClick={nextRound} className="rounded-lg border border-arena-border px-5 py-3 text-arena-muted">New round</button>{score && <p className="ml-auto font-display text-xl font-bold text-white">Score: {score.points}/{score.maxScore} ({score.percent}%)</p>}</div>
    </section>
  </div>;
}
