"use client";

import { useEffect, useState, type FormEvent } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { Challenge, Game, OpponentMode, PlayerProfile } from "@/lib/types";

type Phase = "form" | "submitting" | "success" | "error";

export function CreateChallengeModal({
  open,
  onClose,
  games,
  currentUser,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  games: Game[];
  currentUser: PlayerProfile | null;
  onCreated: (challenge: Challenge) => void;
}) {
  const { getAccessToken } = usePrivy();
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [entryFee, setEntryFee] = useState("");
  const [opponentMode, setOpponentMode] = useState<OpponentMode>("open");
  const [invitedOpponent, setInvitedOpponent] = useState("");
  const [rules, setRules] = useState("Best of 1. Both players must confirm match result in Discord.");
  const [expirationMinutes, setExpirationMinutes] = useState(60);
  const [phase, setPhase] = useState<Phase>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (open) {
      setPhase("form");
      setErrorMessage(null);
      setShareUrl(null);
      setEntryFee("");
      setOpponentMode("open");
      setInvitedOpponent("");
      setRules("Best of 1. Both players must confirm match result in Discord.");
      setExpirationMinutes(60);
      setGameId(games[0]?.id ?? "");
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [open, games]);

  if (!open) return null;

  const isBusy = phase === "submitting";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (!currentUser) {
      setErrorMessage("Finish your SkillFi profile before creating a challenge.");
      return;
    }
    if (!gameId) {
      setErrorMessage("Choose a game.");
      return;
    }

    try {
      setPhase("submitting");
      const token = await getAccessToken();
      if (!token) throw new Error("No Privy access token available.");

      const response = await fetch("/api/matches/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          gameId,
          entryFee,
          currency: "USDC",
          opponentMode,
          invitedOpponent: opponentMode === "invite" ? invitedOpponent : undefined,
          rules,
          expirationMinutes,
          idempotencyKey,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Failed to create challenge.");

      setPhase("success");
      setShareUrl(body.challenge.invitation_url);
      onCreated(body.challenge);
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-challenge-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-arena-border bg-arena-surface p-6 shadow-arena-glow">
        <h2 id="create-challenge-title" className="font-display text-xl font-bold text-arena-text">
          Create a Challenge
        </h2>

        {!currentUser ? (
          <p className="mt-4 rounded-md border border-arena-border bg-arena-bg p-4 text-sm text-arena-muted">
            Finish your SkillFi profile before creating a challenge.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="game" className="mb-1 block text-sm font-medium text-arena-muted">
                Game
              </label>
              <select
                id="game"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                disabled={isBusy}
                className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text focus:border-arena-accent focus:outline-none disabled:opacity-50"
              >
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="entry-fee" className="mb-1 block text-sm font-medium text-arena-muted">
                  Entry fee
                </label>
                <input
                  id="entry-fee"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.000001"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  disabled={isBusy}
                  placeholder="10.00"
                  className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text focus:border-arena-accent focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label htmlFor="currency" className="mb-1 block text-sm font-medium text-arena-muted">
                  Currency
                </label>
                <input
                  id="currency"
                  value="USDC"
                  disabled
                  className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-muted"
                />
              </div>
            </div>

            <div>
              <label htmlFor="opponent-mode" className="mb-1 block text-sm font-medium text-arena-muted">
                Opponent
              </label>
              <select
                id="opponent-mode"
                value={opponentMode}
                onChange={(e) => setOpponentMode(e.target.value as OpponentMode)}
                disabled={isBusy}
                className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text focus:border-arena-accent focus:outline-none disabled:opacity-50"
              >
                <option value="open">Anyone with the link</option>
                <option value="invite">Invite a specific player</option>
              </select>
            </div>

            {opponentMode === "invite" && (
              <div>
                <label htmlFor="invited-opponent" className="mb-1 block text-sm font-medium text-arena-muted">
                  Invited player username, email, or wallet
                </label>
                <input
                  id="invited-opponent"
                  value={invitedOpponent}
                  onChange={(e) => setInvitedOpponent(e.target.value)}
                  disabled={isBusy}
                  className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text focus:border-arena-accent focus:outline-none disabled:opacity-50"
                />
              </div>
            )}

            <div>
              <label htmlFor="rules" className="mb-1 block text-sm font-medium text-arena-muted">
                Match rules
              </label>
              <textarea
                id="rules"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                disabled={isBusy}
                rows={3}
                className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text focus:border-arena-accent focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="expiration" className="mb-1 block text-sm font-medium text-arena-muted">
                Expiration
              </label>
              <select
                id="expiration"
                value={expirationMinutes}
                onChange={(e) => setExpirationMinutes(Number(e.target.value))}
                disabled={isBusy}
                className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text focus:border-arena-accent focus:outline-none disabled:opacity-50"
              >
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={240}>4 hours</option>
                <option value={1440}>24 hours</option>
                <option value={10080}>7 days</option>
              </select>
            </div>

            {phase === "submitting" && (
              <div className="rounded-md border border-arena-accent-dim bg-arena-accent/10 px-3 py-2 text-sm text-arena-accent">
                Creating challenge...
              </div>
            )}

            {shareUrl && (
              <div className="rounded-md border border-arena-win/40 bg-arena-win/10 px-3 py-2 text-sm text-arena-win">
                Invitation URL: <span className="break-all">{shareUrl}</span>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-md border border-arena-danger/40 bg-arena-danger/10 px-3 py-2 text-sm text-arena-danger">
                {errorMessage}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="rounded-md px-4 py-2 text-sm text-arena-muted hover:text-arena-text disabled:opacity-50"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isBusy || !entryFee}
                className="rounded-md bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg hover:bg-arena-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy ? "Creating..." : "Create Challenge"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
