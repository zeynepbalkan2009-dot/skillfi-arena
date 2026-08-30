import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: studio, error: studioError } = await supabaseAdmin.from("studios")
    .select("id").eq("owner_user_id", user.id).maybeSingle();
  if (studioError) return NextResponse.json({ error: "Could not load studio" }, { status: 500 });
  if (!studio) return NextResponse.json({ submissions: [] });
  const { data, error } = await supabaseAdmin.from("game_result_submissions")
    .select("id,event_id,game_id,match_id,winner_user_id,credential_id,payload_hash,source_occurred_at,created_at")
    .eq("studio_id", studio.id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Could not load result submissions" }, { status: 500 });
  return NextResponse.json({ submissions: data ?? [] });
}
