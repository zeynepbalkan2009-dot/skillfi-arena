"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useWriteContract } from "wagmi";
import { ESCROW_CONTRACT_ADDRESS } from "@/lib/contracts";
import { skillFiEscrowAbi } from "@/lib/abi/skillFiEscrow";
import { passageForMatch, scoreTyping } from "@/lib/typingGame";
import { createPilotRound, isPilotGameId, scorePilotRound } from "@/lib/pilotGames";
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
  const { writeContractAsync } = useWriteContract();
  const [match, setMatch] = useState(initialMatch);
  const [text, setText] = useState("");
  const [remaining, setRemaining] = useState(60000);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [opponentProgress, setOpponentProgress] = useState<Progress | null>(null);
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const autoSubmitAttemptedRef = useRef(false);
  const startedAtRef = useRef<number | null>(
    initialMatch.started_at ? new Date(initialMatch.started_at).getTime() : null
  );
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const passage = useMemo(
    () => passageForMatch(initialMatch.smart_contract_match_id),
    [initialMatch.smart_contract_match_id]
  );
  const pilotGameId = isPilotGameId(match.game?.slug) ? match.game.slug : null;
  const pilotRound = useMemo(
    () => pilotGameId ? createPilotRound(pilotGameId, initialMatch.smart_contract_match_id) : null,
    [initialMatch.smart_contract_match_id, pilotGameId]
  );
  const challengePrompt = pilotRound?.prompt ?? passage;
  const isPlayerA = Boolean(
    address && match.player_a?.wallet_address && address.toLowerCase() === match.player_a.wallet_address.toLowerCase()
  );
  const isPlayerB = Boolean(
    address && match.player_b?.wallet_address && address.toLowerCase() === match.player_b.wallet_address.toLowerCase()
  );
  const isParticipant = isPlayerA || isPlayerB;

  async function disputeMatch() {
    const reason = disputeReason.trim().replace(/\s+/g, " ");
    if (!isParticipant || match.status !== "active" || reason.length < 10 || reason.length > 500) return;
    setDisputeBusy(true);
    setResult(null);
    try {
      const txHash = await writeContractAsync({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: skillFiEscrowAbi,
        functionName: "disputeMatch",
        args: [BigInt(match.smart_contract_match_id)],
      });
      const token = await getAccessToken();
      const response = await fetch("/api/matches/dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId: match.id, txHash, reason }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Dispute indexing failed");
      setMatch((current) => ({ ...current, status: "disputed" }));
      setDisputeOpen(false);
      setResult("Match disputed. Automatic settlement is paused for arbiter review.");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Dispute failed");
    } finally {
      setDisputeBusy(false);
    }
  }

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
        body: JSON.stringify({ matchId: match.smart_contract_match_id, answer: text, elapsedMs }),
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
    let active = true;

    async function refreshMatchState() {
      const { data, error } = await supabase
        .from("matches")
        .select("status,winner_id,started_at,player_a_id,player_b_id,updated_at")
        .eq("id", match.id)
        .maybeSingle();

      if (!active || error || !data) return;
      setMatch((current) => ({ ...current, ...data }));
      if (data.started_at) startedAtRef.current = new Date(data.started_at).getTime();
    }

    void refreshMatchState();
    const timer = window.setInterval(refreshMatchState, 3_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [match.id]);

  useEffect(() => {
    if (match.status !== "active" || !startedAtRef.current || submitted) return;
    const tick = () => setRemaining(Math.max(0, 60000 - (Date.now() - (startedAtRef.current as number))));
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [match.status, submitted]);

  useEffect(() => {
    if (remaining === 0 && !submitted && match.status === "active" && !autoSubmitAttemptedRef.current) {
      autoSubmitAttemptedRef.current = true;
      void submitResult();
    }
  }, [match.status, remaining, submitResult, submitted]);

  function broadcastProgress(value: string) {
    if (!channelRef.current || submitted || match.status !== "active") return;
    const elapsed = Math.max(1000, 60000 - remaining);
    const typingScore = scoreTyping(passage, value, elapsed);
    const pilotScore = pilotRound ? scorePilotRound(pilotRound, value) : null;
    channelRef.current.send({
      type: "broadcast",
      event: "progress",
      payload: {
        player: address,
        progress: pilotScore
          ? { wpm: pilotScore.points, accuracy: pilotScore.percent / 100, chars: pilotScore.points }
          : { wpm: typingScore.wpm, accuracy: typingScore.accuracy, chars: typingScore.correctChars },
      },
    });
  }

  const typingScore = scoreTyping(passage, text, Math.max(1000, 60000 - remaining));
  const pilotScore = pilotRound ? scorePilotRound(pilotRound, text) : null;
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
                {pilotRound && pilotGameId !== "typing-sprint" ? challengePrompt : challengePrompt.split("").map((char, index) => (
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
                  if ((!pilotRound || pilotGameId !== "typing-sprint" || event.target.value.length <= challengePrompt.length) && !submitted) {
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
                  <span>{pilotScore ? "Score" : "WPM"} <b className="text-arena-text">{pilotScore?.points ?? typingScore.wpm.toFixed(0)}</b></span>
                  <span>
                    Accuracy <b className="text-arena-text">{pilotScore?.percent ?? (typingScore.accuracy * 100).toFixed(0)}%</b>
                  </span>
                  <span>
                    Correct <b className="text-arena-text">{pilotScore?.points ?? typingScore.correctChars}</b>
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
              <div className="mt-4 border-t border-arena-border pt-4 text-right">
                {!disputeOpen ? (
                  <button
                    type="button"
                    onClick={() => setDisputeOpen(true)}
                    disabled={disputeBusy || submitted}
                    className="text-xs font-medium text-arena-muted underline decoration-arena-border underline-offset-4 hover:text-arena-danger disabled:opacity-40"
                  >
                    Report a result problem
                  </button>
                ) : (
                  <div className="rounded-lg border border-arena-danger/30 bg-arena-danger/5 p-4 text-left">
                    <label htmlFor="dispute-reason" className="text-sm font-semibold text-arena-text">
                      What went wrong?
                    </label>
                    <p className="mt-1 text-xs text-arena-muted">
                      This note becomes part of the match audit trail. Submitting also requires a wallet transaction.
                    </p>
                    <textarea
                      id="dispute-reason"
                      value={disputeReason}
                      maxLength={500}
                      onChange={(event) => setDisputeReason(event.target.value)}
                      placeholder="Describe the result or gameplay problem (minimum 10 characters)."
                      className="mt-3 min-h-24 w-full resize-y rounded-md border border-arena-border bg-arena-bg p-3 text-sm text-arena-text outline-none focus:border-arena-danger"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-arena-muted">{disputeReason.trim().length}/500</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setDisputeOpen(false); setDisputeReason(""); }}
                          disabled={disputeBusy}
                          className="rounded-md border border-arena-border px-3 py-2 text-xs text-arena-muted disabled:opacity-40"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={disputeMatch}
                          disabled={disputeBusy || disputeReason.trim().length < 10}
                          className="rounded-md bg-arena-danger px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          {disputeBusy ? "Opening dispute…" : "Confirm dispute"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
            <aside className="rounded-xl border border-arena-border bg-arena-surface p-5">
              <h2 className="font-display text-lg font-bold">Opponent</h2>
              <p className="mt-1 text-arena-muted">{match.player_b?.username ?? "Player 2"}</p>
              <div className="mt-6">
                <p className="text-xs uppercase tracking-wide text-arena-muted">{pilotRound ? "Live score" : "Live WPM"}</p>
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

        {match.status === "disputed" && (
          <div className="rounded-xl border border-arena-danger/40 bg-arena-danger/10 p-10 text-center">
            <h2 className="font-display text-3xl font-bold text-arena-danger">MATCH DISPUTED</h2>
            <p className="mt-3 text-arena-muted">Automatic settlement is paused. An authorized arbiter must review the result.</p>
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
