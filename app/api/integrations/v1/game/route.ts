import { NextRequest, NextResponse } from "next/server";
import { authenticateGameApiKey } from "@/lib/gameCredentials";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const credential = await authenticateGameApiKey(request.headers.get("authorization"), "game:read");
  if (!credential) return NextResponse.json({ error: "Invalid, expired, revoked, or insufficient integration key" }, { status: 401 });
  const { data: game, error } = await supabaseAdmin.from("games")
    .select("id,name,slug,type,integration_status,is_active,studio_id").eq("id", credential.game_id).eq("studio_id", credential.studio_id).single();
  if (error) return NextResponse.json({ error: "Game is unavailable" }, { status: 404 });
  return NextResponse.json({ game, credential: { id: credential.id, scopes: credential.scopes } });
}

