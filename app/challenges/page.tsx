import { ChallengeHubClient } from "@/components/ChallengeHubClient";
import { supabase } from "@/lib/supabaseClient";
import type { Game, MatchWithRelations } from "@/lib/types";

export const dynamic = "force-dynamic";

const WAITING_MATCH_TTL_MS = 30 * 60 * 1000;

export default async function ChallengesPage() {
  const cutoff = new Date(Date.now() - WAITING_MATCH_TTL_MS).toISOString();
  const [{ data: matches }, { data: games }] = await Promise.all([
    supabase
      .from("matches")
      .select("*, game:games(*), player_a:users!matches_player_a_id_fkey(id,username,display_name,avatar_url,region)")
      .eq("status", "searching")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false }),
    supabase.from("games").select("*").eq("is_active", true).order("name"),
  ]);

  return (
    <ChallengeHubClient
      initialMatches={(matches as MatchWithRelations[] | null) ?? []}
      games={(games as Game[] | null) ?? []}
    />
  );
}
