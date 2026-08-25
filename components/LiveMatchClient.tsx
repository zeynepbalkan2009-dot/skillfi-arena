"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { passageForMatch, scoreTyping } from "@/lib/typingGame";
import { supabase } from "@/lib/supabaseClient";
import type { Game } from "@/lib/types";

type MatchView = {
  id: string;
  smart_contract_match_id: string;
  game: Game | null;
  player_a_id: string;
  player_b_id: string | null;
  status: string;
  winner_id: string | null;
  started_at: string | null;
  player_a: { id: string; username: string; wallet_address: string | null } | null;
  player_b: { id: string; username: string; wallet_address: string | null } | null;
};

type Progress = { wpm: number; accuracy: number; chars: number };

export function LiveMatchClient({ match: initialMatch }: { match: MatchView }) {
  const { getAccessToken } = usePrivy();
  const { address } = useAccount();
  const [match, setMatch] = useState(initialMatch);
  const [text, setText] = useState("");
  const [remaining, setRemaining] = useState(60000);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [opponentProgress, setOpponentProgress] = useState<Progress | null>(null);
  const startedAtRef = useRef<number | null>(
    initialMatch.started_at ? new Date(initialMatch.started_at).getTime() : null
  );
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const passage = useMemo(
    () => passageForMatch(initialMatch.smart_contract_match_id),
    [initialMatch.smart_contract_match_id]
  );
  const isPlayerA = Boolean(
    address && match.player_a?.wallet_address && address.toLowerCase() === match.player_a.wallet_address.toLowerCase()
  );
  const isPlayerB = Boolean(
    address && match.player_b?.wallet_address && address.toLowerCase() === match.player_b.wallet_address.toLowerCase()
  );
  const isParticipant = isPlayerA || isPlayerB;

  const submitResult = useCallback(async () => {
    if (submitted || !isParticipant) return;
    setSubmitted(true);
    const elapsedMs = Math.max(1000, Math.min(60000, 60000 - remaining));

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Log in with Privy first.");

      const response = await fetch("/api/matches/result", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId: match.smart_contract_match_id, typedText: text, elapsedMs }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Result submission failed");

      setResult(
        body.status === "waiting_for_opponent"
          ? "Result locked. Waiting for your opponent..."
          : body.status === "completed"
            ? "Match settled on-chain."
            : "Result submitted."
      );
    } catch (error) {
      setSubmitted(false);
      setResult(error instanceof Error ? error.message : "Result submission failed");
    }
  }, [getAccessToken, isParticipant, match.smart_contract_match_id, remaining, submitted, text]);

  useEffect(() => {
    const channel = supabase
      .channel(`match:${match.id}`)
      .on("broadcast", { event: "progress" }, ({ payload }) => {
        if (payload?.player !== address) setOpponentProgress(payload?.progress ?? null);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${match.id}` }, (payload) => {
        const next = payload.new as MatchView;
        setMatch((current) => ({ ...current, ...next }));
        if (next.started_at) startedAtRef.current = new Date(next.started_at).getTime();
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [address, match.id]);

  useEffect(() => {
    if (match.status !== "active" || !startedAtRef.current || submitted) return;
    const tick = () => setRemaining(Math.max(0, 60000 - (Date.now() - (startedAtRef.current as number))));
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [match.status, submitted]);

  useEffect(() => {
    if (remaining === 0 && !submitted && match.status === "active") {
      void submitResult();
    }
  }, [match.status, remaining, submitResult, submitted]);

  function broadcastProgress(value: string) {
    if (!channelRef.current || submitted || match.status !== "active") return;
    const elapsed = Math.max(1000, 60000 - remaining);
    const score = scoreTyping(passage, value, elapsed);
    channelRef.current.send({
      type: "broadcast",
      event: "progress",
      payload: {
        player: address,
        progress: { wpm: score.wpm, accuracy: score.accuracy, chars: score.correctChars },
      },
    });
  }

  const localScore = scoreTyping(passage, text, Math.max(1000, 60000 - remaining));
  const statusText =
    match.status === "searching"
      ? "Waiting for an opponent"
      : match.status === "active"
        ? "LIVE"
        : match.status === "completed"
          ? "MATCH COMPLETE"
          : match.status.toUpperCase();

  if (!isParticipant && match.status === "active") {
    return (
      <main className="min-h-screen bg-arena-bg p-8 text-arena-text">
        <div className="mx-auto max-w-4xl rounded-xl border border-arena-border bg-arena-surface p-8">
          This match is already full.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-arena-bg px-4 py-8 text-arena-text">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-arena-muted">{match.game?.name ?? "SkillFi Arena"}</p>
            <h1 className="font-display text-3xl font-bold">{statusText}</h1>
          </div>
          <div className="text-right">
            <div className="font-display text-4xl font-bold text-arena-accent">
              {match.status === "active" ? `${Math.ceil(remaining / 1000)}s` : ""}
            </div>
            <p className="text-sm text-arena-muted">
              {match.player_a?.username ?? "Player 1"} vs {match.player_b?.username ?? "Waiting..."}
            </p>
          </div>
        </div>

        {match.status === "searching" && (
          <div className="rounded-xl border border-arena-border bg-arena-surface p-10 text-center">
            <div className="mx-auto mb-4 h-3 w-3 animate-pulse rounded-full bg-arena-accent" />
            <h2 className="font-display text-2xl font-bold">Waiting for Player 2</h2>
            <p className="mt-2 text-arena-muted">
              Keep this page open. The match will start automatically when another player joins.
            </p>
          </div>
        )}

        {match.status === "active" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <section className="rounded-xl border border-arena-border bg-arena-surface p-6">
              <p className="mb-4 text-lg leading-8 text-arena-muted">
                {passage.split("").map((char, index) => (
                  <span
                    key={index}
                    className={index < text.length ? (text[index] === char ? "text-arena-text" : "text-arena-danger") : ""}
                  >
                    {char}
                  </span>
                ))}
              </p>
              <textarea
                autoFocus
                value={text}
                onChange={(event) => {
                  if (event.target.value.length <= passage.length && !submitted) {
                    setText(event.target.value);
                    broadcastProgress(event.target.value);
                  }
                }}
                disabled={submitted || remaining === 0}
                className="min-h-36 w-full resize-none rounded-lg border border-arena-border bg-arena-bg p-4 text-lg leading-8 text-arena-text outline-none focus:border-arena-accent"
                placeholder="Start typing..."
              />
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-5 text-sm text-arena-muted">
                  <span>
                    WPM <b className="text-arena-text">{localScore.wpm.toFixed(0)}</b>
                  </span>
                  <span>
                    Accuracy <b className="text-arena-text">{(localScore.accuracy * 100).toFixed(0)}%</b>
                  </span>
                  <span>
                    Correct <b className="text-arena-text">{localScore.correctChars}</b>
                  </span>
                </div>
                <button
                  onClick={submitResult}
                  disabled={submitted}
                  className="rounded-md bg-arena-accent px-5 py-2 font-semibold text-arena-bg disabled:opacity-50"
                >
                  {submitted ? "Submitted" : "Finish"}
                </button>
              </div>
            </section>
            <aside className="rounded-xl border border-arena-border bg-arena-surface p-5">
              <h2 className="font-display text-lg font-bold">Opponent</h2>
              <p className="mt-1 text-arena-muted">{match.player_b?.username ?? "Player 2"}</p>
              <div className="mt-6">
                <p className="text-xs uppercase tracking-wide text-arena-muted">Live WPM</p>
                <p className="font-display text-4xl font-bold text-arena-accent">
                  {opponentProgress?.wpm.toFixed(0) ?? "-"}
                </p>
                <p className="mt-2 text-sm text-arena-muted">
                  {opponentProgress
                    ? `${opponentProgress.chars} correct chars / ${(opponentProgress.accuracy * 100).toFixed(0)}%`
                    : "Waiting for input..."}
                </p>
              </div>
            </aside>
          </div>
        )}

        {match.status === "completed" && (
          <div className="rounded-xl border border-arena-border bg-arena-surface p-10 text-center">
            <h2 className="font-display text-3xl font-bold">
              {match.winner_id === (isPlayerA ? match.player_a_id : match.player_b_id) ? "YOU WIN" : "YOU LOSE"}
            </h2>
            <p className="mt-3 text-arena-muted">The result has been settled on-chain.</p>
          </div>
        )}

        {result && (
          <div className="mt-5 rounded-lg border border-arena-accent-dim bg-arena-accent/10 p-4 text-center text-arena-accent">
            {result}
          </div>
        )}
      </div>
    </main>
  );
}
