import { ChallengeHubClient } from "@/components/ChallengeHubClient";
import { supabase } from "@/lib/supabaseClient";
import type { Game, MatchWithRelations } from "@/lib/types";

export const dynamic = "force-dynamic";

const WAITING_MATCH_TTL_MS = 30 * 60 * 1000;
const OPEN_MATCH_SELECT = `
  id,
  smart_contract_match_id,
  game_id,
  player_a_id,
  stake_amount,
  status,
  created_at,
  game:games!inner(
    id,
    slug,
    name,
    type,
    description,
    website_url,
    is_active
  ),
  player_a:users!matches_player_a_id_fkey(
    id,
    username,
    display_name,
    avatar_url,
    region
  )
`;
const PUBLIC_GAME_SELECT = "id,slug,name,type,description,website_url,is_active";

export default async function ChallengesPage() {
  const cutoff = new Date(Date.now() - WAITING_MATCH_TTL_MS).toISOString();
  const [{ data: matches }, { data: games }] = await Promise.all([
    supabase
      .from("matches")
      .select(OPEN_MATCH_SELECT)
      .eq("status", "searching")
      .eq("game.is_active", true)
      .eq("game.integration_status", "published")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false }),
    supabase
      .from("games")
      .select(PUBLIC_GAME_SELECT)
      .eq("is_active", true)
      .eq("integration_status", "published")
      .order("name"),
  ]);

  return (
    <ChallengeHubClient
      initialMatches={(matches as MatchWithRelations[] | null) ?? []}
      games={(games as Game[] | null) ?? []}
    />
  );
}
