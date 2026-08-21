"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useSkillFiUser } from "@/components/AuthSync";
import { ChallengeCard } from "@/components/ChallengeCard";
import { CreateChallengeModal } from "@/components/CreateChallengeModal";
import { OnboardingCard } from "@/components/OnboardingCard";
import { WalletConnect } from "@/components/WalletConnect";
import type { Challenge, ChallengeWithRelations, Game } from "@/lib/types";

export function LobbyClient({
  initialChallenges,
  games,
}: {
  initialChallenges: ChallengeWithRelations[];
  games: Game[];
}) {
  const { authenticated } = usePrivy();
  const { profile: currentUser, loading: userLoading, needsProfile } = useSkillFiUser();
  const [challenges, setChallenges] = useState<ChallengeWithRelations[]>(initialChallenges);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel("public:challenges")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "challenges" },
        (payload: RealtimePostgresChangesPayload<Challenge>) => {
          void handleRealtimeChange(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchChallenge(id: string): Promise<ChallengeWithRelations | null> {
    const { data, error } = await supabase
      .from("challenges")
      .select(
        "id,game_id,creator_id,invited_opponent_id,accepted_by_id,match_id,entry_fee,currency,opponent_mode,rules,status,expires_at,accepted_at,created_at,updated_at, game:games(*), creator:users!challenges_creator_id_fkey(id,username,display_name,avatar_url,region,wallet_address,primary_wallet_address), invited_opponent:users!challenges_invited_opponent_id_fkey(id,username,display_name,avatar_url,region,wallet_address,primary_wallet_address), accepted_by:users!challenges_accepted_by_id_fkey(id,username,display_name,avatar_url,region,wallet_address,primary_wallet_address)"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Failed to load challenge:", error.message);
      return null;
    }
    return (data as ChallengeWithRelations | null) ?? null;
  }

  async function handleRealtimeChange(payload: RealtimePostgresChangesPayload<Challenge>) {
    if (payload.eventType === "DELETE") {
      const oldRow = payload.old as Partial<Challenge>;
      setChallenges((current) => current.filter((challenge) => challenge.id !== oldRow.id));
      return;
    }

    const row = payload.new as Challenge;
    if (!["open", "accepted"].includes(row.status)) {
      setChallenges((current) => current.filter((challenge) => challenge.id !== row.id));
      return;
    }

    const withRelations = await fetchChallenge(row.id);
    if (!withRelations) return;

    setChallenges((current) => {
      const withoutThisRow = current.filter((challenge) => challenge.id !== row.id);
      return [withRelations, ...withoutThisRow];
    });
  }

  function handleCreated(challenge: Challenge) {
    const withRelations: ChallengeWithRelations = {
      ...challenge,
      game: games.find((game) => game.id === challenge.game_id) ?? null,
      creator: currentUser,
      invited_opponent: null,
      accepted_by: null,
    };
    setChallenges((current) => [withRelations, ...current.filter((item) => item.id !== challenge.id)]);
  }

  const sortedChallenges = useMemo(
    () => [...challenges].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [challenges]
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
                <h2 className="font-display text-lg font-semibold text-arena-text">Challenges</h2>
                <p className="text-sm text-arena-muted">Create an off-chain challenge and share the invitation URL.</p>
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

            {sortedChallenges.length === 0 ? (
              <div className="rounded-lg border border-dashed border-arena-border py-16 text-center text-arena-muted">
                No open or accepted challenges yet.
              </div>
            ) : (
              <div className="space-y-3">
                {sortedChallenges.map((challenge) => (
                  <ChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    isOwnChallenge={challenge.creator_id === currentUser?.id}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <CreateChallengeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        games={games}
        currentUser={currentUser}
        onCreated={handleCreated}
      />
    </div>
  );
}
