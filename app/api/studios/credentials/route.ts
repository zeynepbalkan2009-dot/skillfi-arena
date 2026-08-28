import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { createGameApiKey } from "@/lib/gameCredentials";
import { recordStudioAudit } from "@/lib/studioAudit";
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

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { gameId?: string; name?: string } | null;
  const name = body?.name?.trim() ?? "";
  if (!body?.gameId || name.length < 2 || name.length > 80) return NextResponse.json({ error: "gameId and a 2-80 character key name are required" }, { status: 400 });
  const { data: studio } = await supabaseAdmin.from("studios").select("id,status").eq("owner_user_id", user.id).maybeSingle();
  if (!studio || !['pending_review', 'approved'].includes(studio.status)) return NextResponse.json({ error: "Studio is not eligible for integration credentials" }, { status: 403 });
  const { data: game } = await supabaseAdmin.from("games").select("id,studio_id,integration_status").eq("id", body.gameId).eq("studio_id", studio.id).maybeSingle();
  if (!game || !['sandbox', 'published'].includes(game.integration_status)) return NextResponse.json({ error: "Credentials require a sandbox or published game" }, { status: 409 });
  const generated = createGameApiKey(game.integration_status === "published" ? "live" : "test");
  const scopes = ["game:read", "results:write"];
  const { data: credential, error } = await supabaseAdmin.from("game_api_credentials").insert({
    game_id: game.id, studio_id: studio.id, name, key_prefix: generated.prefix, secret_hash: generated.secretHash,
    scopes, created_by_user_id: user.id,
  }).select("id,game_id,name,key_prefix,scopes,last_used_at,expires_at,revoked_at,created_at").single();
  if (error) return NextResponse.json({ error: "Could not create integration credential" }, { status: 500 });
  await recordStudioAudit({ studioId: studio.id, gameId: game.id, actorUserId: user.id, eventType: "game_credential_created", idempotencyKey: `game_credential_created:${credential.id}`, payload: { credentialId: credential.id, keyPrefix: credential.key_prefix, scopes, selfService: true } });
  return NextResponse.json({ credential, secret: generated.secret, warning: "Copy this key now. It will not be shown again." }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { credentialId?: string } | null;
  if (!body?.credentialId) return NextResponse.json({ error: "credentialId is required" }, { status: 400 });
  const { data: studio } = await supabaseAdmin.from("studios").select("id").eq("owner_user_id", user.id).maybeSingle();
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  const { data: credential, error } = await supabaseAdmin.from("game_api_credentials")
    .update({ revoked_at: new Date().toISOString() }).eq("id", body.credentialId).eq("studio_id", studio.id).is("revoked_at", null)
    .select("id,game_id,studio_id,key_prefix,revoked_at").maybeSingle();
  if (error || !credential) return NextResponse.json({ error: "Credential is missing or already revoked" }, { status: 409 });
  await recordStudioAudit({ studioId: studio.id, gameId: credential.game_id, actorUserId: user.id, eventType: "game_credential_revoked", idempotencyKey: `game_credential_revoked:${credential.id}`, payload: { credentialId: credential.id, keyPrefix: credential.key_prefix, selfService: true } });
  return NextResponse.json({ credential });
}
