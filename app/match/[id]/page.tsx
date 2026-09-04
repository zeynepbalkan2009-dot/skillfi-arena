import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { LiveMatchClient } from "@/components/LiveMatchClient";

export const dynamic = "force-dynamic";

const LIVE_MATCH_SELECT = `
  id,
  smart_contract_match_id,
  game_id,
  player_a_id,
  player_b_id,
  status,
  winner_id,
  started_at,
  game:games(
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
    region,
    wallet_address
  ),
  player_b:users!matches_player_b_id_fkey(
    id,
    username,
    region,
    wallet_address
  )
`;

export default async function MatchPage({ params }: { params: { id: string } }) {
  const { data: match, error } = await supabaseAdmin
    .from("matches")
    .select(LIVE_MATCH_SELECT)
    .eq("smart_contract_match_id", params.id)
    .maybeSingle();

  if (error || !match) notFound();
  return <LiveMatchClient match={match} />;
}
