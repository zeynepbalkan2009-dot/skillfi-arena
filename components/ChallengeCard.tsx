"use client";

import Link from "next/link";
import { formatUsdcUnits } from "@/lib/env/public";
import type { ChallengeWithRelations } from "@/lib/types";

function timeLeft(isoTimestamp: string): string {
  const ms = new Date(isoTimestamp).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes}m left`;
  if (minutes < 1440) return `${Math.ceil(minutes / 60)}h left`;
  return `${Math.ceil(minutes / 1440)}d left`;
}

export function ChallengeCard({
  challenge,
  isOwnChallenge,
}: {
  challenge: ChallengeWithRelations;
  isOwnChallenge: boolean;
}) {
  const opponent =
    challenge.accepted_by?.username ??
    challenge.invited_opponent?.username ??
    (challenge.opponent_mode === "open" ? "Open invite" : "Invited player");
  const viewHref = challenge.invitation_url
    ? challenge.invitation_url.startsWith("http")
      ? new URL(challenge.invitation_url).pathname
      : challenge.invitation_url
    : null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-arena-border bg-arena-surface px-5 py-4 transition-colors hover:border-arena-accent-dim sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-arena-bg font-display text-sm font-bold text-arena-accent">
          {challenge.game?.name?.slice(0, 2).toUpperCase() ?? "??"}
        </div>
        <div>
          <p className="font-display font-semibold leading-tight text-arena-text">
            {challenge.game?.name ?? "Unknown game"}
          </p>
          <p className="text-sm text-arena-muted">
            {challenge.creator?.username ?? "Anonymous"} vs {opponent}
          </p>
          <p className="text-xs text-arena-muted">
            {challenge.status} · {timeLeft(challenge.expires_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-5 sm:justify-end">
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-arena-muted">Entry</p>
          <p className="font-display text-lg font-bold text-arena-text">
            {formatUsdcUnits(challenge.entry_fee)} USDC
          </p>
        </div>

        {challenge.status === "accepted" ? (
          <span className="rounded-md border border-arena-win/40 px-4 py-2 text-sm text-arena-win">
            Accepted
          </span>
        ) : isOwnChallenge ? (
          <span className="rounded-md border border-arena-border px-4 py-2 text-sm text-arena-muted">
            Your challenge
          </span>
        ) : viewHref ? (
          <Link
            href={viewHref}
            className="rounded-md bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg hover:bg-arena-accent/90"
          >
            View
          </Link>
        ) : (
          <span className="rounded-md border border-arena-border px-4 py-2 text-sm text-arena-muted">
            Link required
          </span>
        )}
      </div>
    </div>
  );
}
