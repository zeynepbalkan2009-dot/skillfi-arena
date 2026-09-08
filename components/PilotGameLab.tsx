"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  createPilotRound,
  PILOT_GAMES,
  scorePilotRound,
  type PilotGameId,
} from "@/lib/pilotGames";

type SavedRun = { scorePercent: number; rating: number | null };

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
  const [completedRuns, setCompletedRuns] = useState<Record<string, SavedRun>>(
    {},
  );
  const game = PILOT_GAMES.find((item) => item.id === gameId) ?? PILOT_GAMES[0];
  const round = useMemo(
    () => createPilotRound(gameId, `pilot-${attempt}`),
    [attempt, gameId],
  );
  const score = submitted ? scorePilotRound(round, answer) : null;
  const completedCount = Object.keys(completedRuns).length;

  const loadRuns = useCallback(async () => {
    if (!authenticated) {
      setCompletedRuns({});
      return;
    }
    const token = await getAccessToken();
    if (!token) return;
    const response = await fetch("/api/pilot/runs", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return;
    setCompletedRuns(
      Object.fromEntries(
        (body.runs ?? []).map(
          (run: {
            game_slug: string;
            score_percent: number;
            feedback_rating: number | null;
          }) => [
            run.game_slug,
            { scorePercent: run.score_percent, rating: run.feedback_rating },
          ],
        ),
      ),
    );
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  function resetRound() {
    setAnswer("");
    setSubmitted(false);
    setRating("");
    setFeedback("");
    setSaveMessage("");
    setRoundStartedAt(Date.now());
  }
  function selectGame(next: PilotGameId) {
    setGameId(next);
    setAttempt(1);
    resetRound();
  }
  function nextRound() {
    setAttempt((value) => value + 1);
    resetRound();
  }

  async function saveRun() {
    if (!score || !authenticated) {
      setSaveMessage(
        "Sign in with an active beta account to save this result.",
      );
      return;
    }
    setSaving(true);
    setSaveMessage("");
    const token = await getAccessToken();
    const response = await fetch("/api/pilot/runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        gameSlug: gameId,
        scorePercent: score.percent,
        durationMs: Math.max(1000, Date.now() - roundStartedAt),
        feedbackRating: rating ? Number(rating) : null,
        feedbackNote: feedback,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    setSaveMessage(
      response.ok
        ? "Pilot result saved."
        : (body.error ?? "Result could not be saved."),
    );
    if (response.ok)
      setCompletedRuns((current) => ({
        ...current,
        [gameId]: {
          scorePercent: score.percent,
          rating: rating ? Number(rating) : null,
        },
      }));
  }

  return (
    <div className="grid border-y border-arena-border lg:grid-cols-[17rem_1fr]">
      <aside className="border-b border-arena-border lg:border-b-0 lg:border-r">
        <div className="border-b border-arena-border p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-arena-muted">
                Saved coverage
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-white">
                {completedCount} / 5
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[.14em] text-arena-accent">
              {completedCount === 5 ? "Complete" : "In progress"}
            </span>
          </div>
          <div
            className="mt-4 grid grid-cols-5 gap-1"
            aria-label={`${completedCount} of 5 games saved`}
          >
            {PILOT_GAMES.map((item) => (
              <span
                key={item.id}
                className={`h-1 ${completedRuns[item.id] ? "bg-arena-accent" : "bg-white/10"}`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
        <nav aria-label="Pilot games">
          {PILOT_GAMES.map((item, index) => {
            const saved = completedRuns[item.id];
            const selected = item.id === gameId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectGame(item.id)}
                aria-pressed={selected}
                className={`grid w-full grid-cols-[2rem_1fr] gap-3 border-b border-arena-border px-5 py-4 text-left transition-colors ${selected ? "bg-white/[.045]" : "hover:bg-white/[.025]"}`}
              >
                <span
                  className={`font-mono text-[10px] ${selected ? "text-arena-accent" : "text-slate-600"}`}
                >
                  0{index + 1}
                </span>
                <span>
                  <strong className="block text-sm font-semibold text-white">
                    {item.name}
                  </strong>
                  <span className="mt-1 flex justify-between gap-2 text-[11px] text-arena-muted">
                    <span>{item.skill}</span>
                    {saved ? (
                      <span className="font-semibold text-arena-win">
                        {saved.scorePercent}% saved
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section
        aria-labelledby="active-game-title"
        className="min-w-0 p-5 sm:p-8"
      >
        <header className="grid gap-5 border-b border-arena-border pb-6 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-arena-accent">
              Game 0{PILOT_GAMES.findIndex((item) => item.id === gameId) + 1} ·
              Round {attempt}
            </p>
            <h2
              id="active-game-title"
              className="mt-2 font-display text-3xl font-bold text-white"
            >
              {game.name}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-arena-muted">
              {game.instructions}
            </p>
          </div>
          <p className="w-fit border-l-2 border-arena-accent pl-3 text-xs leading-5 text-arena-muted">
            No stake
            <br />
            No prize
            <br />
            Test only
          </p>
        </header>
        <div className="my-7 border-l-2 border-white/20 bg-black/15 px-5 py-6 font-mono text-base leading-8 text-white sm:text-lg">
          {round.prompt}
        </div>
        <label
          className="text-xs font-bold uppercase tracking-[.14em] text-slate-400"
          htmlFor="pilot-answer"
        >
          Your answer
        </label>
        <textarea
          id="pilot-answer"
          value={answer}
          onChange={(event) => {
            setAnswer(event.target.value);
            setSubmitted(false);
          }}
          className="mt-3 min-h-32 w-full resize-y border border-arena-border bg-arena-bg p-4 text-white outline-none transition-colors focus:border-arena-accent"
          placeholder="Enter your response"
        />
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setSubmitted(true)}
            disabled={!answer.trim()}
            className="bg-arena-accent px-5 py-3 text-sm font-bold text-arena-bg transition-colors hover:bg-cyan-200 disabled:opacity-40"
          >
            Check result
          </button>
          <button
            type="button"
            onClick={nextRound}
            className="border-b border-arena-muted py-2 text-sm text-arena-muted hover:border-white hover:text-white"
          >
            New round →
          </button>
          {score ? (
            <p className="ml-auto border-l border-arena-border pl-4 text-right">
              <span className="block text-[10px] uppercase tracking-[.16em] text-arena-muted">
                Result
              </span>
              <strong className="font-display text-xl text-white">
                {score.points}/{score.maxScore} · {score.percent}%
              </strong>
            </p>
          ) : null}
        </div>
        {score ? (
          <section
            aria-labelledby="feedback-title"
            className="mt-8 border-t border-arena-border pt-6"
          >
            <h3
              id="feedback-title"
              className="text-sm font-semibold text-white"
            >
              Beta feedback{" "}
              <span className="font-normal text-arena-muted">(optional)</span>
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr]">
              <select
                aria-label="Experience rating"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                className="border border-arena-border bg-arena-bg px-3 py-3 text-sm"
              >
                <option value="">Experience rating</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}/5
                  </option>
                ))}
              </select>
              <input
                value={feedback}
                maxLength={1000}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="What worked or failed?"
                className="border border-arena-border bg-arena-bg px-3 py-3 text-sm"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={saveRun}
                disabled={saving}
                className="border border-arena-accent/40 px-4 py-2 text-xs font-bold text-arena-accent hover:bg-arena-accent/10 disabled:opacity-40"
              >
                {saving ? "SAVING…" : "SAVE BETA RESULT"}
              </button>
              {saveMessage ? (
                <p role="status" className="text-xs text-arena-muted">
                  {saveMessage}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>
    </div>
  );
}
