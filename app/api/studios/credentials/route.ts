import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: studio } = await supabaseAdmin.from("studios").select("id").eq("owner_user_id", user.id).maybeSingle();
  if (!studio) return NextResponse.json({ credentials: [] });
  const { data, error } = await supabaseAdmin.from("game_api_credentials")
    .select("id,game_id,name,key_prefix,scopes,last_used_at,expires_at,revoked_at,created_at")
    .eq("studio_id", studio.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load integration credentials" }, { status: 500 });
  return NextResponse.json({ credentials: data ?? [] });
}

