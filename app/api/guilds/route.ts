import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { validateGuildInput } from "@/lib/guilds";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Guild } from "@/lib/types";

type GuildMemberRow = { guild_id: string; user_id: string; role: string };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  const { data, error } = await supabaseAdmin.from("guilds").select("*").order("season_influence", { ascending: false });
  if (error) {
    const setupRequired = error.code === "42P01" || error.code === "PGRST205";
    return NextResponse.json({ error: setupRequired ? "Guild database migration is pending" : "Could not load guilds", setupRequired }, { status: 503 });
  }
  const guilds = (data ?? []) as Guild[];
  const ids = guilds.map((guild) => guild.id);
  const { data: memberData } = ids.length ? await supabaseAdmin.from("guild_members").select("guild_id,user_id,role").in("guild_id", ids) : { data: [] };
  const members = (memberData ?? []) as GuildMemberRow[];
  const hydrated = guilds.map((guild) => ({ ...guild, member_count: members.filter((member) => member.guild_id === guild.id).length, current_user_role: members.find((member) => member.guild_id === guild.id && member.user_id === user?.id)?.role ?? null }));
  return NextResponse.json({ guilds: hydrated, currentGuild: hydrated.find((guild) => guild.current_user_role) ?? null });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { name?: string; description?: string; emblem?: string } | null;
  let input;
  try { input = validateGuildInput(body ?? {}); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid guild" }, { status: 400 }); }
  const { data, error } = await supabaseAdmin.rpc("create_guild_with_owner", { p_owner_user_id: user.id, p_name: input.name, p_slug: input.slug, p_description: input.description, p_emblem: input.emblem });
  if (error) return NextResponse.json({ error: /already belongs/i.test(error.message) ? "You already belong to a guild" : error.code === "23505" ? "That guild name is already taken" : "Could not create guild" }, { status: 409 });
  return NextResponse.json({ guild: data }, { status: 201 });
}
