import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { createGameApiKey } from "@/lib/gameCredentials";
import { isStudioAdmin } from "@/lib/studioAdmin";
import { recordStudioAudit } from "@/lib/studioAudit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user || !isStudioAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { gameId?: string; name?: string; scopes?: string[]; expiresAt?: string } | null;
  const name = body?.name?.trim() ?? "";
  if (!body?.gameId || name.length < 2 || name.length > 80) return NextResponse.json({ error: "gameId and a 2-80 character key name are required" }, { status: 400 });
  const scopes = [...new Set(body.scopes ?? ["game:read"])] as string[];
  if (!scopes.length || scopes.some((scope) => !['game:read', 'results:write'].includes(scope))) return NextResponse.json({ error: "Invalid credential scopes" }, { status: 400 });
  const { data: game } = await supabaseAdmin.from("games").select("id,studio_id,integration_status").eq("id", body.gameId).maybeSingle();
  if (!game?.studio_id || !['sandbox', 'published'].includes(game.integration_status)) return NextResponse.json({ error: "Credentials require a sandbox or published studio game" }, { status: 409 });
  let expiresAt: string | null = null;
  if (body.expiresAt) {
    const parsed = new Date(body.expiresAt);
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) return NextResponse.json({ error: "Credential expiry must be in the future" }, { status: 400 });
    expiresAt = parsed.toISOString();
  }
  const environment = game.integration_status === "published" ? "live" : "test";
  const generated = createGameApiKey(environment);
  const { data: credential, error } = await supabaseAdmin.from("game_api_credentials").insert({
    game_id: game.id, studio_id: game.studio_id, name, key_prefix: generated.prefix,
    secret_hash: generated.secretHash, scopes, expires_at: expiresAt, created_by_user_id: user.id,
  }).select("id,game_id,studio_id,name,key_prefix,scopes,expires_at,created_at").single();
  if (error) return NextResponse.json({ error: "Could not create integration credential" }, { status: 500 });
  await recordStudioAudit({ studioId: game.studio_id, gameId: game.id, actorUserId: user.id, eventType: "game_credential_created", idempotencyKey: `game_credential_created:${credential.id}`, payload: { credentialId: credential.id, keyPrefix: credential.key_prefix, scopes } });
  return NextResponse.json({ credential, secret: generated.secret, warning: "Copy this key now. It will not be shown again." }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user || !isStudioAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { credentialId?: string } | null;
  if (!body?.credentialId) return NextResponse.json({ error: "credentialId is required" }, { status: 400 });
  const { data: credential, error } = await supabaseAdmin.from("game_api_credentials")
    .update({ revoked_at: new Date().toISOString() }).eq("id", body.credentialId).is("revoked_at", null)
    .select("id,game_id,studio_id,key_prefix,revoked_at").maybeSingle();
  if (error || !credential) return NextResponse.json({ error: "Credential is missing or already revoked" }, { status: 409 });
  await recordStudioAudit({ studioId: credential.studio_id, gameId: credential.game_id, actorUserId: user.id, eventType: "game_credential_revoked", idempotencyKey: `game_credential_revoked:${credential.id}`, payload: { credentialId: credential.id, keyPrefix: credential.key_prefix } });
  return NextResponse.json({ credential });
}

