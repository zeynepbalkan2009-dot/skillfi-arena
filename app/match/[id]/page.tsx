import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { LiveMatchClient } from "@/components/LiveMatchClient";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: { id: string } }) {
  const { data: match, error } = await supabase
    .from("matches")
    .select("*, game:games(*), player_a:users!matches_player_a_id_fkey(id,username,region,wallet_address), player_b:users!matches_player_b_id_fkey(id,username,region,wallet_address)")
    .eq("smart_contract_match_id", params.id)
    .maybeSingle();

  if (error || !match) notFound();
  return <LiveMatchClient match={match} />;
}
