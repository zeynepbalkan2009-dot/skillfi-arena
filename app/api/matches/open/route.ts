import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const WAITING_MATCH_TTL_MS = 30 * 60 * 1000;

export async function GET() {
  const cutoff = new Date(Date.now() - WAITING_MATCH_TTL_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select(
      "*, game:games(*), player_a:users!matches_player_a_id_fkey(id,username,display_name,avatar_url,region)"
    )
    .eq("status", "searching")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load open matches" }, { status: 500 });
  }
  return NextResponse.json({ matches: data ?? [] });
}
