"use client";

import type { MatchWithRelations } from "@/lib/types";

const REGION_LABELS: Record<string, string> = {
  EU: "Europe",
  NA: "N. America",
  ASIA: "Asia",
};

function formatStake(rawAmount: string, decimals = 18): string {
  // rawAmount is a base-unit integer as a string (see lib/types.ts) — do
  // the decimal shift with BigInt, not Number(), to avoid precision loss
  // on large stakes.
  const value = BigInt(rawAmount);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  if (fraction === BigInt(0)) return whole.toString();
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 2);
  return `${whole}.${fractionStr}`;
}

function timeAgo(isoTimestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function ChallengeCard({
  match,
  isOwnChallenge,
}: {
  match: MatchWithRelations;
  isOwnChallenge: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-arena-border bg-arena-surface px-5 py-4 transition-colors hover:border-arena-accent-dim">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-arena-bg font-display text-sm font-bold text-arena-accent">
          {match.game?.name?.slice(0, 2).toUpperCase() ?? "??"}
        </div>
        <div>
          <p className="font-display font-semibold leading-tight text-arena-text">
            {match.game?.name ?? "Unknown game"}
          </p>
          <p className="text-sm text-arena-muted">
            {match.player_a?.username ?? "Anonymous"} ·{" "}
            {match.player_a ? REGION_LABELS[match.player_a.region] : "—"} · {timeAgo(match.created_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-arena-muted">Stake</p>
          <p className="font-display text-lg font-bold text-arena-text">{formatStake(match.stake_amount)} GNESS</p>
        </div>

        {isOwnChallenge ? (
          <span className="rounded-md border border-arena-border px-4 py-2 text-sm text-arena-muted">
            Your challenge
          </span>
        ) : (
          <button
            type="button"
            disabled
            title="Joining is coming in the next milestone — wires up the same approve+joinMatch flow as creating a challenge."
            className="cursor-not-allowed rounded-md bg-arena-accent/20 px-4 py-2 text-sm font-semibold text-arena-accent/60"
          >
            Join
          </button>
        )}
      </div>
    </div>
  );
}
