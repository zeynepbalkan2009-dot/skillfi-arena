import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile(request.headers.get("authorization"));
  if (!profile) {
    return NextResponse.json({ error: "Invalid or missing Privy access token" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("matches")
    .select(
      "id,challenge_id,smart_contract_match_id,game_id,player_a_id,player_b_id,stake_amount,status,winner_id,started_at,created_at,updated_at,game:games(id,name,type,is_active,created_at),player_a:users!matches_player_a_id_fkey(id,username,display_name,region,wallet_address),player_b:users!matches_player_b_id_fkey(id,username,display_name,region,wallet_address)"
    )
    .or(`player_a_id.eq.${profile.id},player_b_id.eq.${profile.id}`)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: "Could not load match history" }, { status: 500 });
  }
  const matchIds = (data ?? []).map((match: { id: string }) => match.id);
  const { data: events, error: eventsError } = matchIds.length
    ? await supabaseAdmin
        .from("match_audit_events")
        .select("id,match_id,challenge_id,actor_user_id,event_type,tx_hash,payload,created_at")
        .in("match_id", matchIds)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };

  if (eventsError) {
    return NextResponse.json({ error: "Could not load transaction history" }, { status: 500 });
  }
  return NextResponse.json({ matches: data ?? [], events: events ?? [] });
}
