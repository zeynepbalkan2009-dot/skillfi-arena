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
      <main className="mx-auto max-w-[1440px] px-3 py-4 sm:px-5 sm:py-6 xl:px-7">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="launcher-kicker">
              Matchmaking / Arc Testnet
            </div>
            <h1 className="launcher-title mt-4 font-display text-5xl font-black sm:text-6xl">
              Open challenges
            </h1>
            <p className="mt-2 text-sm text-arena-muted">
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
            className="launcher-button-primary min-h-11 px-5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create challenge
          </button>
        </div>
        <PilotAccessBanner status={pilotStatus} />
        <section className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#e7e7e1] bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-arena-muted">
              Open now
            </p>
            <p className="mt-2 font-display text-3xl font-bold">
              {sorted.length}
            </p>
          </div>
          <div className="rounded-2xl border border-[#e7e7e1] bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9095a0]">
              Network
            </p>
            <p className="mt-2 font-display text-2xl font-black text-[#252833]">
              Arc Testnet
            </p>
          </div>
          <div className="rounded-2xl border border-[#e7e7e1] bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9095a0]">
              Pilot asset
            </p>
            <p className="mt-2 font-display text-2xl font-black text-[#252833]">
              {SETTLEMENT_ASSET_LABEL}
            </p>
          </div>
        </section>
        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_300px]">
          <section>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">
                  Available now
                </h2>
                <p className="mt-1 text-xs text-[#858b96]">
                  Verified results · Testnet-only sessions
                </p>
              </div>
              <span className="rounded-lg border border-[#e7e7e1] bg-[#f6f6f3] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#6d7480]">
                Online
              </span>
            </div>
            {needsProfile ? (
              <OnboardingCard />
            ) : sorted.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#dcdcd5] bg-[#fafaf8] py-12 text-center">
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
          <aside className="launcher-panel self-start p-5 sm:p-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#9095a0]">
              Before you join
            </p>
            <h2 className="mt-2 font-display text-2xl font-black text-[#252833]">
              A fair start takes a minute.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#777d88]">
              Confirm the game, region and testnet amount before signing. Keep
              this page open while a second player connects.
            </p>
            <ol className="mt-6 space-y-4 text-xs leading-5 text-arena-muted">
              <li className="border-t border-[#e7e7e1] pt-3">
                <span className="mr-3 font-mono text-arena-accent">01</span>Use
                the wallet linked to your pilot profile.
              </li>
              <li className="border-t border-[#e7e7e1] pt-3">
                <span className="mr-3 font-mono text-arena-accent">02</span>
                Approve only the displayed testnet asset.
              </li>
              <li className="border-t border-[#e7e7e1] pt-3">
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
      <div className="mt-7 grid border-y border-arena-border bg-[#f3f7f4] sm:grid-cols-[10rem_1fr_auto] sm:items-center">
        <div className="border-b border-emerald-300/20 px-4 py-4 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#3f7d50]">
            Access / Active
          </p>
        </div>
        <p className="px-4 py-4 text-sm leading-6 text-arena-muted">
          Your account can create and join the five controlled pilot games.
        </p>
        <Link
          href="/pilot/games"
          className="mx-4 mb-4 border-b border-arena-border pb-1 text-xs font-bold text-[#356b43] sm:mb-0"
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
    <div className="mt-7 grid border-y border-arena-border bg-[#f7f5ef] sm:grid-cols-[10rem_1fr_auto] sm:items-center">
      <div className="border-b border-amber-300/20 px-4 py-4 sm:border-b-0 sm:border-r">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8a6b2d]">
          Access / Locked
        </p>
      </div>
      <p className="px-4 py-4 text-sm leading-6 text-slate-400">{copy}</p>
      <Link
        href="/pilot"
        className="mx-4 mb-4 border-b border-arena-border pb-1 text-xs font-bold text-[#765b24] sm:mb-0"
      >
        View pilot access →
      </Link>
    </div>
  );
}
