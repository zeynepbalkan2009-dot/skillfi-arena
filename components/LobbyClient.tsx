"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { ChallengeCard } from "@/components/ChallengeCard";
import { CreateChallengeModal } from "@/components/CreateChallengeModal";
import { WalletConnect } from "@/components/WalletConnect";
import type { Game, Match, MatchWithRelations, PlayerProfile } from "@/lib/types";

export function LobbyClient({
  initialMatches,
  games,
}: {
  initialMatches: MatchWithRelations[];
  games: Game[];
}) {
  const { address } = useAccount();
  const [matches, setMatches] = useState<MatchWithRelations[]>(initialMatches);
  const [currentUser, setCurrentUser] = useState<PlayerProfile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Resolve the connected wallet to a SkillFi account. `ilike` with no
  // wildcards does a case-insensitive exact match — addresses may be stored
  // checksummed or lowercased depending on signup path.
  useEffect(() => {
    if (!address) {
      setCurrentUser(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("users")
      .select("id, username, region, wallet_address")
      .ilike("wallet_address", address)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCurrentUser(data ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Realtime: keep the lobby in sync as challenges are created/joined/
  // cancelled by anyone, without polling. Subscribes to every change on
  // `matches` (not pre-filtered to status=searching) because a status
  // transition *away* from searching is exactly the kind of update we need
  // to react to by removing the card — a server-side equality filter on
  // the new status would still fire for that UPDATE, but reasoning about
  // old-vs-new state is simplest done here in the handler.
  useEffect(() => {
    const channel = supabase
      .channel("public:matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        (payload: RealtimePostgresChangesPayload<Match>) => {
          handleRealtimeChange(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRealtimeChange(payload: RealtimePostgresChangesPayload<Match>) {
    if (payload.eventType === "DELETE") {
      const oldRow = payload.old as Partial<Match>;
      setMatches((current) => current.filter((m) => m.id !== oldRow.id));
      return;
    }

    const row = payload.new as Match;

    if (row.status !== "searching") {
      // No longer joinable — drop it from the lobby if present.
      setMatches((current) => current.filter((m) => m.id !== row.id));
      return;
    }

    // It's a searching match we should be showing. The realtime payload
    // only carries the base `matches` columns, not the joined game/player —
    // the game is already in our small, fully-loaded `games` list, but the
    // creator's profile needs a small follow-up fetch.
    const game = games.find((g) => g.id === row.game_id) ?? null;
    const { data: playerA } = await supabase
      .from("users")
      .select("id, username, region, wallet_address")
      .eq("id", row.player_a_id)
      .maybeSingle();

    setMatches((current) => {
      const withRelations: MatchWithRelations = { ...row, game, player_a: playerA ?? null };
      const withoutThisRow = current.filter((m) => m.id !== row.id);
      return [withRelations, ...withoutThisRow];
    });
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
              {currentUser ? `Welcome back, ${currentUser.username}` : "Skill-based PvP, settled on-chain"}
            </p>
          </div>
          <WalletConnect />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-arena-text">Open Challenges</h2>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={!address}
            title={address ? undefined : "Connect your wallet first"}
            className="rounded-md bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg hover:bg-arena-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Create Challenge
          </button>
        </div>

        {sortedMatches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-arena-border py-16 text-center text-arena-muted">
            No open challenges right now. Be the first to create one.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedMatches.map((match) => (
              <ChallengeCard key={match.id} match={match} isOwnChallenge={match.player_a_id === currentUser?.id} />
            ))}
          </div>
        )}
      </main>

      <CreateChallengeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        games={games}
        currentUser={currentUser}
      />
    </div>
  );
}
