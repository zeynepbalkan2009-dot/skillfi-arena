import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: guild } = await supabaseAdmin.from("guilds").select("id,join_policy").eq("id", params.id).maybeSingle();
  if (!guild) return NextResponse.json({ error: "Guild not found" }, { status: 404 });
  if (guild.join_policy !== "open") return NextResponse.json({ error: "This guild requires an invitation or approval" }, { status: 409 });
  const { data: existing } = await supabaseAdmin.from("guild_members").select("guild_id").eq("user_id", user.id).maybeSingle();
  if (existing) return NextResponse.json({ error: "You already belong to a guild" }, { status: 409 });
  const { error } = await supabaseAdmin.from("guild_members").insert({ guild_id: guild.id, user_id: user.id, role: "member" });
  if (error) return NextResponse.json({ error: "Could not join guild" }, { status: 500 });
  return NextResponse.json({ joined: true });
}
