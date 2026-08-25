"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { ChallengeCard } from "@/components/ChallengeCard";
import { CreateChallengeModal } from "@/components/CreateChallengeModal";
import { OnboardingCard } from "@/components/OnboardingCard";
import { WalletConnect } from "@/components/WalletConnect";
import { useSkillFiUser } from "@/components/AuthSync";
import { supabase } from "@/lib/supabaseClient";
import type { Game, Match, MatchWithRelations } from "@/lib/types";

export function LobbyClient({
  initialMatches,
  games,
}: {
  initialMatches: MatchWithRelations[];
  games: Game[];
}) {
  const { authenticated } = usePrivy();
  const { profile: currentUser, loading: userLoading, needsProfile } = useSkillFiUser();
  const [matches, setMatches] = useState<MatchWithRelations[]>(initialMatches);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel("public:matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        (payload: RealtimePostgresChangesPayload<Match>) => {
          void handleRealtimeChange(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games]);

  async function handleRealtimeChange(payload: RealtimePostgresChangesPayload<Match>) {
    if (payload.eventType === "DELETE") {
      const oldRow = payload.old as Partial<Match>;
      setMatches((current) => current.filter((match) => match.id !== oldRow.id));
      return;
    }

    const row = payload.new as Match;
    if (row.status !== "searching") {
      setMatches((current) => current.filter((match) => match.id !== row.id));
      return;
    }

    const game = games.find((item) => item.id === row.game_id) ?? null;
    const { data: playerA } = await supabase
      .from("users")
      .select("id, username, region, wallet_address")
      .eq("id", row.player_a_id)
      .maybeSingle();

    const withRelations: MatchWithRelations = { ...row, game, player_a: playerA ?? null };
    setMatches((current) => [withRelations, ...current.filter((match) => match.id !== row.id)]);
  }

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [matches]
  );

  return (
    <div className="min-h-screen">
      <header className="bg-arena-grid border-b border-arena-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wide text-arena-text">SKILLFI ARENA</h1>
            <p className="text-sm text-arena-muted">
              {currentUser ? `Welcome back, ${currentUser.display_name ?? currentUser.username}` : "Skill-based PvP"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {currentUser && (
              <Link href="/profile" className="text-sm font-medium text-arena-muted hover:text-arena-text">
                Profile
              </Link>
            )}
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {needsProfile ? (
          <OnboardingCard />
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-arena-text">Open Challenges</h2>
                <p className="text-sm text-arena-muted">Create a stake-backed live match and wait for an opponent.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                disabled={!authenticated || userLoading}
                title={authenticated ? undefined : "Connect first"}
                className="rounded-md bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg hover:bg-arena-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create Challenge
              </button>
            </div>

            {sortedMatches.length === 0 ? (
              <div className="rounded-lg border border-dashed border-arena-border py-16 text-center text-arena-muted">
                No open challenges right now.
              </div>
            ) : (
              <div className="space-y-3">
                {sortedMatches.map((match) => (
                  <ChallengeCard key={match.id} match={match} isOwnChallenge={match.player_a_id === currentUser?.id} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <CreateChallengeModal open={modalOpen} onClose={() => setModalOpen(false)} games={games} currentUser={currentUser} />
    </div>
  );
}
