import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select(
      "*, game:games(*), player_a:users!matches_player_a_id_fkey(id,username,region,wallet_address)"
    )
    .eq("status", "searching")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load open matches" }, { status: 500 });
  }
  return NextResponse.json({ matches: data ?? [] });
}
