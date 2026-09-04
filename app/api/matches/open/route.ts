import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

export async function GET() {
  const cutoff = new Date(Date.now() - WAITING_MATCH_TTL_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select(OPEN_MATCH_SELECT)
    .eq("status", "searching")
    .eq("game.is_active", true)
    .eq("game.integration_status", "published")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Could not load open matches" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { matches: data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
