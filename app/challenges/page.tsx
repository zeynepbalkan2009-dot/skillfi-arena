import { ChallengeHubClient } from "@/components/ChallengeHubClient";
import { supabase } from "@/lib/supabaseClient";
import type { Game, MatchWithRelations } from "@/lib/types";

export const dynamic = "force-dynamic";
export default async function ChallengesPage() {
  const [{data:matches},{data:games}] = await Promise.all([
    supabase.from("matches").select("*, game:games(*), player_a:users!matches_player_a_id_fkey(id,username,region,wallet_address)").eq("status","searching").order("created_at",{ascending:false}),
    supabase.from("games").select("*").eq("is_active",true).order("name")
  ]);
  return <ChallengeHubClient initialMatches={(matches as MatchWithRelations[]|null)??[]} games={(games as Game[]|null)??[]}/>;
}
