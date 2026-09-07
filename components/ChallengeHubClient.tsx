"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { GameShell } from "@/components/GameShell";
import { ChallengeCard } from "@/components/ChallengeCard";
import { CreateChallengeModal } from "@/components/CreateChallengeModal";
import { WaitingMotion } from "@/components/motion/WaitingMotion";
import { OnboardingCard } from "@/components/OnboardingCard";
import { useSkillFiUser } from "@/components/AuthSync";
import type { Game, MatchWithRelations } from "@/lib/types";
import { SETTLEMENT_ASSET_LABEL } from "@/lib/contracts";

export function ChallengeHubClient({
  initialMatches,
  games,
}: {
  initialMatches: MatchWithRelations[];
  games: Game[];
}) {
  const { authenticated, getAccessToken } = usePrivy();
  const { profile, loading, needsProfile } = useSkillFiUser();
  const [matches, setMatches] = useState(initialMatches);
  const [modalOpen, setModalOpen] = useState(false);
  const [pilotStatus, setPilotStatus] = useState<
    | "signed_out"
    | "none"
    | "applied"
    | "active"
    | "completed"
    | "withdrawn"
    | "rejected"
    | "loading"
  >("loading");
  useEffect(() => {
    setMatches(initialMatches);
  }, [initialMatches]);
  const loadPilotStatus = useCallback(async () => {
    if (!authenticated) {
      setPilotStatus("signed_out");
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setPilotStatus("signed_out");
      return;
    }
    const response = await fetch("/api/pilot/enroll", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    setPilotStatus(response.ok ? (data.enrollment?.status ?? "none") : "none");
  }, [authenticated, getAccessToken]);
  useEffect(() => {
    if (!loading) void loadPilotStatus();
  }, [loading, loadPilotStatus]);
  const sorted = useMemo(
    () =>
      [...matches].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [matches],
  );
  const pilotActive = pilotStatus === "active";

  return (
    <GameShell>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[.18em] text-arena-accent">
              Matchmaking / Arc Testnet
            </div>
            <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-.035em] text-white sm:text-6xl">
              Open challenges
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Choose a verified game and join another approved pilot player.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            disabled={!authenticated || loading || !pilotActive}
            title={
              pilotActive
                ? "Create a pilot challenge"
                : "Active beta access is required"
            }
            className="min-h-11 bg-arena-accent px-5 text-sm font-semibold text-[#071015] transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create challenge
          </button>
        </div>
        <PilotAccessBanner status={pilotStatus} />
        <section className="mt-10 grid border-y border-arena-border md:grid-cols-3">
          <div className="border-b border-arena-border py-5 md:border-b-0 md:border-r md:px-6 md:first:pl-0">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">
              Open now
            </p>
            <p className="mt-2 font-display text-3xl font-bold">
              {sorted.length}
            </p>
          </div>
          <div className="border-b border-arena-border py-5 md:border-b-0 md:border-r md:px-6">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">
              Network
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-white">
              Arc Testnet
            </p>
          </div>
          <div className="py-5 md:px-6 md:last:pr-0">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">
              Pilot asset
            </p>
            <p className="mt-2 font-display text-2xl font-bold">
              {SETTLEMENT_ASSET_LABEL}
            </p>
          </div>
        </section>
        <div className="mt-10 grid gap-10 xl:grid-cols-[1fr_280px]">
          <section>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">
                  Available now
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Verified results · Testnet-only sessions
                </p>
              </div>
              <span className="border border-emerald-300/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-emerald-300">
                Online
              </span>
            </div>
            {needsProfile ? (
              <OnboardingCard />
            ) : sorted.length === 0 ? (
              <div className="border border-dashed border-arena-border py-12 text-center">
                <WaitingMotion compact label="The arena is quiet" />
                <p className="mt-4 text-sm text-slate-500">
                  Be the first active pilot player to open a challenge.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sorted.map((match) => (
                  <ChallengeCard
                    key={match.id}
                    match={match}
                    isOwnChallenge={match.player_a_id === profile?.id}
                    canJoin={pilotActive}
                  />
                ))}
              </div>
            )}
          </section>
          <aside className="border-t border-arena-border pt-5 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-600">
              Before you join
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">
              A fair start takes a minute.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Confirm the game, region and testnet amount before signing. Keep
              this page open while a second player connects.
            </p>
            <ol className="mt-6 space-y-4 text-xs leading-5 text-arena-muted">
              <li className="border-t border-arena-border pt-3">
                <span className="mr-3 font-mono text-arena-accent">01</span>Use
                the wallet linked to your pilot profile.
              </li>
              <li className="border-t border-arena-border pt-3">
                <span className="mr-3 font-mono text-arena-accent">02</span>
                Approve only the displayed testnet asset.
              </li>
              <li className="border-t border-arena-border pt-3">
                <span className="mr-3 font-mono text-arena-accent">03</span>Wait
                for the shared countdown before playing.
              </li>
            </ol>
          </aside>
        </div>
      </main>
      <CreateChallengeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        games={games}
        currentUser={profile}
      />
    </GameShell>
  );
}

function PilotAccessBanner({
  status,
}: {
  status:
    | "signed_out"
    | "none"
    | "applied"
    | "active"
    | "completed"
    | "withdrawn"
    | "rejected"
    | "loading";
}) {
  if (status === "active")
    return (
      <div className="mt-7 grid border-y border-emerald-300/20 bg-emerald-300/[.035] sm:grid-cols-[10rem_1fr_auto] sm:items-center">
        <div className="border-b border-emerald-300/20 px-4 py-4 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300">
            Access / Active
          </p>
        </div>
        <p className="px-4 py-4 text-sm leading-6 text-slate-400">
          Your account can create and join the five controlled pilot games.
        </p>
        <Link
          href="/pilot/games"
          className="mx-4 mb-4 border-b border-emerald-300/40 pb-1 text-xs font-bold text-emerald-200 sm:mb-0"
        >
          Practice games →
        </Link>
      </div>
    );
  const copy =
    status === "applied"
      ? "Your application is awaiting manual review."
      : status === "loading"
        ? "Checking controlled-beta access…"
        : status === "rejected"
          ? "Your application was not selected for this cohort."
          : status === "completed"
            ? "Your current pilot session has been completed."
            : status === "withdrawn"
              ? "Your pilot application is withdrawn."
              : status === "signed_out"
                ? "Sign in and apply before entering a pilot match."
                : "Apply for the controlled beta before entering a pilot match.";
  return (
    <div className="mt-7 grid border-y border-amber-300/20 bg-amber-300/[.03] sm:grid-cols-[10rem_1fr_auto] sm:items-center">
      <div className="border-b border-amber-300/20 px-4 py-4 sm:border-b-0 sm:border-r">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-amber-200">
          Access / Locked
        </p>
      </div>
      <p className="px-4 py-4 text-sm leading-6 text-slate-400">{copy}</p>
      <Link
        href="/pilot"
        className="mx-4 mb-4 border-b border-amber-200/30 pb-1 text-xs font-bold text-amber-100 sm:mb-0"
      >
        View pilot access →
      </Link>
    </div>
  );
}
