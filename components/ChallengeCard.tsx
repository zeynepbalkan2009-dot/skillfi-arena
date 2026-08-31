"use client";

import Link from "next/link";
import type { MatchWithRelations } from "@/lib/types";
import { JoinMatchButton } from "@/components/JoinMatchButton";
import { CancelMatchButton } from "@/components/CancelMatchButton";
import { SETTLEMENT_ASSET_LABEL } from "@/lib/contracts";

const REGION_LABELS: Record<string, string> = { EU: "Europe", NA: "N. America", ASIA: "Asia" };

function formatStake(rawAmount: string, decimals = 6): string {
  const value = BigInt(rawAmount);
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(decimals, "0").slice(0, 2)}`;
}

function timeAgo(isoTimestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function ChallengeCard({ match, isOwnChallenge, canJoin = true }: { match: MatchWithRelations; isOwnChallenge: boolean; canJoin?: boolean }) {
  const region = match.player_a ? REGION_LABELS[match.player_a.region] ?? match.player_a.region : "-";
  const matchId = match.smart_contract_match_id ?? match.id;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-arena-border bg-arena-surface px-5 py-4 transition-colors hover:border-arena-accent-dim sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-arena-bg font-display text-sm font-bold text-arena-accent">
          {match.game?.name?.slice(0, 2).toUpperCase() ?? "??"}
        </div>
        <div>
          <p className="font-display font-semibold leading-tight text-arena-text">
            {match.game?.name ?? "Unknown game"}
          </p>
          <p className="text-sm text-arena-muted">
            {match.player_a?.username ?? "Anonymous"} / {region} / {timeAgo(match.created_at)}
          </p>
          {match.status === "waiting_on_chain" && (
            <p className="mt-1 text-xs text-arena-accent">Awaiting your deposit · safe to cancel</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-5 sm:justify-end">
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-arena-muted">Stake</p>
          <p className="font-display text-lg font-bold text-arena-text">{formatStake(match.stake_amount)} {SETTLEMENT_ASSET_LABEL}</p>
        </div>
        {isOwnChallenge ? (
          <CancelMatchButton matchId={match.id} />
        ) : !canJoin ? (
          <Link href="/pilot" className="rounded-md border border-amber-300/25 bg-amber-300/[.06] px-4 py-2 text-xs font-bold text-amber-100">
            BETA ACCESS
          </Link>
        ) : (
          <JoinMatchButton matchId={matchId} stakeAmount={match.stake_amount} />
        )}
      </div>
    </div>
  );
}
