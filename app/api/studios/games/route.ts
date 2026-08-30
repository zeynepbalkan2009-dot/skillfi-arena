import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { normalizeStudioSlug, optionalUrl } from "@/lib/studios";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordStudioAudit } from "@/lib/studioAudit";

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: studio } = await supabaseAdmin.from("studios").select("id,status").eq("owner_user_id", user.id).maybeSingle();
  if (!studio) return NextResponse.json({ error: "Create a studio account first" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { name?: string; type?: string; description?: string; websiteUrl?: string } | null;
  const name = body?.name?.trim() ?? "";
  const slug = normalizeStudioSlug(`${studio.id.slice(0, 8)}-${name}`);
  if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "Game name must be between 2 and 100 characters" }, { status: 400 });
  if (!body?.description?.trim() || body.description.trim().length > 1000) return NextResponse.json({ error: "Game description is required and must be at most 1000 characters" }, { status: 400 });
  if (!['web2', 'web3'].includes(body.type ?? "")) return NextResponse.json({ error: "Game type must be web2 or web3" }, { status: 400 });
  let websiteUrl: string | null;
  try { websiteUrl = optionalUrl(body.websiteUrl); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid website" }, { status: 400 }); }
  const { data, error } = await supabaseAdmin.from("games").insert({
    studio_id: studio.id, created_by_user_id: user.id, name, slug, type: body.type,
    description: body.description.trim(), website_url: websiteUrl, integration_status: "draft", is_active: false,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "A game with this name already exists" : "Could not create game draft" }, { status: 409 });
  await recordStudioAudit({ studioId: studio.id, gameId: data.id, actorUserId: user.id, eventType: "game_draft_created", idempotencyKey: `game_draft_created:${data.id}`, payload: { name: data.name } });
  return NextResponse.json({ game: data }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { gameId?: string; name?: string; type?: string; description?: string; websiteUrl?: string } | null;
  if (!body?.gameId) return NextResponse.json({ error: "gameId is required" }, { status: 400 });
  const name = body.name?.trim() ?? "";
  if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "Game name must be between 2 and 100 characters" }, { status: 400 });
  if (!body.description?.trim() || body.description.trim().length > 1000) return NextResponse.json({ error: "Game description is required and must be at most 1000 characters" }, { status: 400 });
  if (!['web2', 'web3'].includes(body.type ?? "")) return NextResponse.json({ error: "Game type must be web2 or web3" }, { status: 400 });
  let websiteUrl: string | null;
  try { websiteUrl = optionalUrl(body.websiteUrl); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid website" }, { status: 400 }); }
  const { data: studio } = await supabaseAdmin.from("studios").select("id").eq("owner_user_id", user.id).maybeSingle();
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  const slug = normalizeStudioSlug(`${studio.id.slice(0, 8)}-${name}`);
  const { data: game, error } = await supabaseAdmin.from("games").update({
    name, slug, type: body.type, description: body.description.trim(), website_url: websiteUrl,
    integration_status: "draft", is_active: false,
  }).eq("id", body.gameId).eq("studio_id", studio.id).in("integration_status", ["draft", "rejected"]).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "A game with this name already exists" : "Could not update game draft" }, { status: 409 });
  if (!game) return NextResponse.json({ error: "Only draft or rejected games can be edited" }, { status: 409 });
  await recordStudioAudit({ studioId: studio.id, gameId: game.id, actorUserId: user.id, eventType: "game_draft_updated", idempotencyKey: `game_draft_updated:${game.id}:${crypto.randomUUID()}`, payload: { name: game.name } });
  return NextResponse.json({ game });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { gameId?: string } | null;
  if (!body?.gameId) return NextResponse.json({ error: "gameId is required" }, { status: 400 });
  const { data: studio } = await supabaseAdmin.from("studios").select("id,status").eq("owner_user_id", user.id).maybeSingle();
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  if (!['pending_review', 'approved'].includes(studio.status)) return NextResponse.json({ error: "Pay the listing fee before submitting a game" }, { status: 409 });
  const { data: game, error } = await supabaseAdmin.from("games").update({ integration_status: "submitted" })
    .eq("id", body.gameId).eq("studio_id", studio.id).eq("integration_status", "draft").select("*").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not submit game" }, { status: 500 });
  if (!game) return NextResponse.json({ error: "Only a draft game can be submitted" }, { status: 409 });
  await recordStudioAudit({ studioId: studio.id, gameId: game.id, actorUserId: user.id, eventType: "game_submitted", idempotencyKey: `game_submitted:${game.id}` });
  return NextResponse.json({ game });
}
