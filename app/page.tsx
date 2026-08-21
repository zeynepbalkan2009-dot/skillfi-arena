import { supabase } from "@/lib/supabaseClient";
import { LobbyClient } from "@/components/LobbyClient";
import type { ChallengeWithRelations, Game } from "@/lib/types";

// The lobby's whole point is showing live state — never serve a cached
// build-time snapshot of `matches`.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ data: challenges, error: challengesError }, { data: games, error: gamesError }] = await Promise.all([
    (supabase as any)
      .from("challenges")
      .select(
        "id,game_id,creator_id,invited_opponent_id,accepted_by_id,match_id,entry_fee,currency,opponent_mode,rules,status,expires_at,accepted_at,created_at,updated_at, game:games(*), creator:users!challenges_creator_id_fkey(id,username,display_name,avatar_url,region,wallet_address,primary_wallet_address), invited_opponent:users!challenges_invited_opponent_id_fkey(id,username,display_name,avatar_url,region,wallet_address,primary_wallet_address), accepted_by:users!challenges_accepted_by_id_fkey(id,username,display_name,avatar_url,region,wallet_address,primary_wallet_address)"
      )
      .in("status", ["open", "accepted"])
      .order("created_at", { ascending: false }),
    (supabase as any).from("games").select("*").eq("is_active", true).order("name"),
  ]);

  if (challengesError) console.error("Failed to load initial challenges:", challengesError.message);
  if (gamesError) console.error("Failed to load games:", gamesError.message);

  return (
    <LobbyClient
      initialChallenges={(challenges as ChallengeWithRelations[] | null) ?? []}
      games={(games as Game[] | null) ?? []}
    />
  );
}
