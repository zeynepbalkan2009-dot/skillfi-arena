"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { createPilotRound, PILOT_GAMES, scorePilotRound, type PilotGameId } from "@/lib/pilotGames";

export function PilotGameLab() {
  const { authenticated, getAccessToken } = usePrivy();
  const [gameId, setGameId] = useState<PilotGameId>(PILOT_GAMES[0].id);
  const [attempt, setAttempt] = useState(1);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [roundStartedAt, setRoundStartedAt] = useState(() => Date.now());
  const [rating, setRating] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [completedRuns, setCompletedRuns] = useState<Record<string, { scorePercent: number; rating: number | null }>>({});
  const game = PILOT_GAMES.find((item) => item.id === gameId) ?? PILOT_GAMES[0];
  const round = useMemo(() => createPilotRound(gameId, `pilot-${attempt}`), [attempt, gameId]);
  const score = submitted ? scorePilotRound(round, answer) : null;

  const loadRuns = useCallback(async () => {
    if (!authenticated) { setCompletedRuns({}); return; }
    const token = await getAccessToken();
    if (!token) return;
    const response = await fetch("/api/pilot/runs", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return;
    setCompletedRuns(Object.fromEntries((body.runs ?? []).map((run: { game_slug: string; score_percent: number; feedback_rating: number | null }) => [run.game_slug, { scorePercent: run.score_percent, rating: run.feedback_rating }])));
  }, [authenticated, getAccessToken]);

  useEffect(() => { void loadRuns(); }, [loadRuns]);

  function resetRound() { setAnswer(""); setSubmitted(false); setRating(""); setFeedback(""); setSaveMessage(""); setRoundStartedAt(Date.now()); }
  function selectGame(next: PilotGameId) { setGameId(next); setAttempt(1); resetRound(); }
  function nextRound() { setAttempt((value) => value + 1); resetRound(); }
  async function saveRun() {
    if (!score || !authenticated) { setSaveMessage("Sign in with an active beta account to save this result."); return; }
    setSaving(true); setSaveMessage("");
    const token = await getAccessToken();
    const response = await fetch("/api/pilot/runs", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ gameSlug: gameId, scorePercent: score.percent, durationMs: Math.max(1000, Date.now() - roundStartedAt), feedbackRating: rating ? Number(rating) : null, feedbackNote: feedback }) });
    const body = await response.json().catch(() => ({}));
    setSaving(false); setSaveMessage(response.ok ? "Pilot result saved." : body.error ?? "Result could not be saved.");
    if (response.ok) setCompletedRuns((current) => ({ ...current, [gameId]: { scorePercent: score.percent, rating: rating ? Number(rating) : null } }));
  }

  return <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
    <div><div className="mb-3 rounded-xl border border-arena-border bg-arena-surface p-4"><div className="flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-arena-muted">Saved beta coverage</p><p className="mt-1 font-display text-2xl font-bold text-white">{Object.keys(completedRuns).length}/5 games</p></div><span className="text-xs text-arena-accent">{Object.keys(completedRuns).length === 5 ? "COMPLETE" : "IN PROGRESS"}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-arena-bg"><div className="h-full bg-arena-accent transition-all" style={{ width: `${Object.keys(completedRuns).length * 20}%` }}/></div></div><nav className="space-y-2" aria-label="Pilot games">{PILOT_GAMES.map((item, index) => { const saved = completedRuns[item.id]; return <button key={item.id} onClick={() => selectGame(item.id)} className={`w-full rounded-xl border p-4 text-left ${item.id === gameId ? "border-arena-accent bg-arena-accent/10" : "border-arena-border bg-arena-surface"}`}><span className="flex items-center justify-between text-xs text-arena-muted"><span>GAME {index + 1}</span>{saved && <span className="font-bold text-arena-win">SAVED · {saved.scorePercent}%</span>}</span><strong className="mt-1 block text-white">{item.name}</strong><span className="text-xs text-arena-muted">{item.skill}</span></button>; })}</nav></div>
    <section className="rounded-2xl border border-arena-border bg-arena-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-arena-accent">Original skill-only pilot</p><h2 className="mt-2 font-display text-3xl font-bold">{game.name}</h2><p className="mt-1 text-sm text-arena-muted">{game.instructions}</p></div><span className="rounded-full border border-arena-border px-3 py-1 text-xs text-arena-muted">No stake · no prize · test only</span></div>
      <div className="my-6 rounded-xl border border-arena-border bg-arena-bg p-6 text-lg leading-9 text-white">{round.prompt}</div>
      <label className="text-sm font-semibold" htmlFor="pilot-answer">Your answer</label>
      <textarea id="pilot-answer" value={answer} onChange={(event) => { setAnswer(event.target.value); setSubmitted(false); }} className="mt-2 min-h-28 w-full rounded-xl border border-arena-border bg-arena-bg p-4 text-white outline-none focus:border-arena-accent" />
      <div className="mt-4 flex flex-wrap items-center gap-3"><button onClick={() => setSubmitted(true)} disabled={!answer.trim()} className="rounded-lg bg-arena-accent px-5 py-3 font-bold text-arena-bg disabled:opacity-40">Check result</button><button onClick={nextRound} className="rounded-lg border border-arena-border px-5 py-3 text-arena-muted">New round</button>{score && <p className="ml-auto font-display text-xl font-bold text-white">Score: {score.points}/{score.maxScore} ({score.percent}%)</p>}</div>
      {score && <div className="mt-6 rounded-xl border border-arena-border bg-arena-bg p-4"><p className="text-sm font-semibold text-white">Beta feedback (optional)</p><div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]"><select aria-label="Experience rating" value={rating} onChange={(event) => setRating(event.target.value)} className="rounded-lg border border-arena-border bg-arena-surface px-3 py-2 text-sm"><option value="">Rating</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select><input value={feedback} maxLength={1000} onChange={(event) => setFeedback(event.target.value)} placeholder="What worked or failed?" className="rounded-lg border border-arena-border bg-arena-surface px-3 py-2 text-sm" /></div><button onClick={saveRun} disabled={saving} className="mt-3 rounded-lg border border-arena-accent/40 px-4 py-2 text-xs font-bold text-arena-accent disabled:opacity-40">{saving ? "SAVING…" : "SAVE BETA RESULT"}</button>{saveMessage && <p role="status" className="mt-2 text-xs text-arena-muted">{saveMessage}</p>}</div>}
    </section>
  </div>;
}
