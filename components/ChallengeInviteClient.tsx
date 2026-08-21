"use client";

import Link from "next/link";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { formatUsdcUnits } from "@/lib/env/public";
import { useSkillFiUser } from "@/components/AuthSync";
import { OnboardingCard } from "@/components/OnboardingCard";
import { WalletConnect } from "@/components/WalletConnect";
import type { ChallengeWithRelations, MatchWithRelations } from "@/lib/types";

export function ChallengeInviteClient({
  challenge,
  invitationToken,
}: {
  challenge: ChallengeWithRelations;
  invitationToken: string;
}) {
  const { authenticated, getAccessToken } = usePrivy();
  const { profile, loading, needsProfile } = useSkillFiUser();
  const [match, setMatch] = useState<MatchWithRelations | null>(challenge.match ?? null);
  const [status, setStatus] = useState<"idle" | "accepting" | "accepted" | "error">(
    challenge.status === "accepted" ? "accepted" : "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  const creatorName = challenge.creator?.display_name ?? challenge.creator?.username ?? "Player A";
  const acceptedName =
    match?.player_b?.display_name ??
    match?.player_b?.username ??
    challenge.accepted_by?.display_name ??
    challenge.accepted_by?.username ??
    null;
  const isCreator = profile?.id === challenge.creator_id;
  const isExpired = new Date(challenge.expires_at).getTime() <= Date.now();
  const canAccept =
    authenticated &&
    profile &&
    !isCreator &&
    challenge.status === "open" &&
    !isExpired &&
    status !== "accepting";

  async function acceptChallenge() {
    if (!canAccept) return;
    setStatus("accepting");
    setMessage(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No Privy access token available.");

      const response = await fetch(`/api/challenges/${challenge.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invitationToken }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not accept challenge.");

      setMatch(body.match);
      setStatus("accepted");
      setMessage("Challenge accepted. The canonical match now has both players.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not accept challenge.");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm font-medium text-arena-muted hover:text-arena-text">
          Back to lobby
        </Link>
        <WalletConnect />
      </div>

      <section className="rounded-lg border border-arena-border bg-arena-surface p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-arena-muted">SkillFi Challenge</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-arena-text">
              {challenge.game?.name ?? "Unknown game"}
            </h1>
            <p className="mt-2 text-sm text-arena-muted">
              {creatorName} vs {acceptedName ?? (challenge.opponent_mode === "open" ? "Open invite" : "Invited player")}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs uppercase tracking-wide text-arena-muted">Entry</p>
            <p className="font-display text-2xl font-bold text-arena-text">
              {formatUsdcUnits(challenge.entry_fee)} USDC
            </p>
          </div>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md bg-arena-bg p-3">
            <dt className="text-arena-muted">Status</dt>
            <dd className="mt-1 font-medium text-arena-text">{status === "accepted" ? "accepted" : challenge.status}</dd>
          </div>
          <div className="rounded-md bg-arena-bg p-3">
            <dt className="text-arena-muted">Expires</dt>
            <dd className="mt-1 font-medium text-arena-text">{new Date(challenge.expires_at).toLocaleString()}</dd>
          </div>
          <div className="rounded-md bg-arena-bg p-3 sm:col-span-2">
            <dt className="text-arena-muted">Rules</dt>
            <dd className="mt-1 whitespace-pre-wrap text-arena-text">{challenge.rules}</dd>
          </div>
        </dl>

        <div className="mt-6">
          {!authenticated ? (
            <div className="rounded-md border border-arena-border bg-arena-bg p-4 text-sm text-arena-muted">
              Connect or log in to accept this challenge.
            </div>
          ) : needsProfile ? (
            <OnboardingCard />
          ) : isCreator ? (
            <div className="rounded-md border border-arena-border bg-arena-bg p-4 text-sm text-arena-muted">
              You created this challenge. Share this URL with another player.
            </div>
          ) : isExpired ? (
            <div className="rounded-md border border-arena-danger/40 bg-arena-danger/10 p-4 text-sm text-arena-danger">
              This invitation has expired.
            </div>
          ) : status === "accepted" ? (
            <div className="rounded-md border border-arena-win/40 bg-arena-win/10 p-4 text-sm text-arena-win">
              Accepted match: {creatorName} vs {acceptedName ?? profile?.username ?? "Player B"}
            </div>
          ) : (
            <button
              type="button"
              onClick={acceptChallenge}
              disabled={!canAccept || loading}
              className="rounded-md bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg hover:bg-arena-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "accepting" ? "Accepting..." : "Accept Challenge"}
            </button>
          )}

          {message && (
            <div
              className={`mt-4 rounded-md border p-4 text-sm ${
                status === "error"
                  ? "border-arena-danger/40 bg-arena-danger/10 text-arena-danger"
                  : "border-arena-win/40 bg-arena-win/10 text-arena-win"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
