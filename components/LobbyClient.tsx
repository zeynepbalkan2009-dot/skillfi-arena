"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { ChallengeCard } from "@/components/ChallengeCard";
import { CreateChallengeModal } from "@/components/CreateChallengeModal";
import { OnboardingCard } from "@/components/OnboardingCard";
import { WalletConnect } from "@/components/WalletConnect";
import { MarketingDetails, MarketingHero, PilotSection } from "@/components/MarketingSections";
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
  const { authenticated, getAccessToken } = usePrivy();
  const { profile: currentUser, loading: userLoading, needsProfile } = useSkillFiUser();
  const [matches, setMatches] = useState<MatchWithRelations[]>(initialMatches);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setMatches(initialMatches);
  }, [initialMatches]);

  useEffect(() => {
    async function refreshOpenMatches() {
      const openResponse = await fetch("/api/matches/open", { cache: "no-store" });
      const openBody = await openResponse.json().catch(() => ({}));
      if (!openResponse.ok) {
        console.error("Failed to refresh open matches:", openBody.error ?? openResponse.statusText);
        return;
      }
      let nextMatches = (openBody.matches as MatchWithRelations[] | null) ?? [];
      if (currentUser) {
        const token = await getAccessToken();
        const ownResponse = await fetch("/api/profile/matches", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const ownBody = await ownResponse.json().catch(() => ({}));
        if (ownResponse.ok) {
          const pendingOwn = ((ownBody.matches as MatchWithRelations[] | null) ?? []).filter(
            (match) => match.player_a_id === currentUser.id && match.status === "waiting_on_chain",
          );
          nextMatches = [...pendingOwn, ...nextMatches.filter((match) => !pendingOwn.some((own) => own.id === match.id))];
        }
      }
      setMatches(nextMatches);
    }

    void refreshOpenMatches();
  }, [currentUser, getAccessToken]);

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
  }, [games, currentUser?.id]);

  async function handleRealtimeChange(payload: RealtimePostgresChangesPayload<Match>) {
    if (payload.eventType === "DELETE") {
      const oldRow = payload.old as Partial<Match>;
      setMatches((current) => current.filter((match) => match.id !== oldRow.id));
      return;
    }

    const row = payload.new as Match;
    const isOwnPending = row.status === "waiting_on_chain" && row.player_a_id === currentUser?.id;
    if (row.status !== "searching" && !isOwnPending) {
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
      <header className="sticky top-0 z-40 border-b border-white/5 bg-arena-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="SkillFi Arena home">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-arena-accent/30 bg-arena-accent/10 font-display text-lg font-bold text-arena-accent shadow-arena-glow">S</span>
            <div>
              <p className="font-display text-lg font-bold leading-none tracking-[0.12em] text-white">SKILLFI</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-arena-muted">Arena</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-arena-muted md:flex" aria-label="Main navigation">
            <a href="#how-it-works" className="transition hover:text-white">How it works</a>
            <a href="#technology" className="transition hover:text-white">Technology</a>
            <a href="#arena" className="transition hover:text-white">Live arena</a>
            <Link href="/about" className="transition hover:text-white">About</Link>
          </nav>
          <div className="flex items-center gap-3">
            {currentUser && (
              <>
                <Link href="/studio" className="hidden text-sm font-medium text-arena-muted hover:text-arena-text sm:block">For studios</Link>
                <Link href="/profile" className="text-sm font-medium text-arena-muted hover:text-arena-text">Profile</Link>
              </>
            )}
            <WalletConnect />
          </div>
        </div>
      </header>

      <MarketingHero />
      <MarketingDetails />

      <main id="arena" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-24 sm:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-arena-accent">Working product</p>
            <h2 className="mt-3 font-display text-4xl font-bold text-white">Live challenge arena</h2>
            <p className="mt-3 text-arena-muted">{currentUser ? `Welcome back, ${currentUser.display_name ?? currentUser.username}.` : "Connect to create or join a testnet challenge."}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-arena-surface/70 p-4 sm:p-6">
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
        </div>
      </main>

      <PilotSection />
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-xs text-arena-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} SkillFi Arena. Built for verifiable competition.</p>
          <div className="flex flex-wrap gap-5"><Link href="/about" className="hover:text-white">About</Link><Link href="/pilot" className="hover:text-white">Pilot</Link><Link href="/technology" className="hover:text-white">Technology</Link><Link href="/security" className="hover:text-white">Security</Link><Link href="/privacy" className="hover:text-white">Privacy</Link><Link href="/terms" className="hover:text-white">Terms</Link></div>
        </div>
      </footer>

      <CreateChallengeModal open={modalOpen} onClose={() => setModalOpen(false)} games={games} currentUser={currentUser} />
    </div>
  );
}
