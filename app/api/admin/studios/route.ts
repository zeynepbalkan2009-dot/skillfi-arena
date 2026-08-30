import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { isStudioAdmin } from "@/lib/studioAdmin";
import { recordStudioAudit } from "@/lib/studioAudit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function admin(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  return user && isStudioAdmin(user) ? user : null;
}

export async function GET(request: NextRequest) {
  const user = await admin(request);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data: studios, error } = await supabaseAdmin.from("studios").select("*").order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Could not load studio reviews" }, { status: 500 });
  const studioIds = (studios ?? []).map((studio: { id: string }) => studio.id);
  const { data: games, error: gamesError } = studioIds.length
    ? await supabaseAdmin.from("games").select("*").in("studio_id", studioIds).order("created_at", { ascending: true })
    : { data: [], error: null };
  if (gamesError) return NextResponse.json({ error: "Could not load game reviews" }, { status: 500 });
  const gameIds = (games ?? []).map((game: { id: string }) => game.id);
  const [{ data: credentials, error: credentialError }, { data: submissions, error: submissionError }] = gameIds.length
    ? await Promise.all([
      supabaseAdmin.from("game_api_credentials").select("game_id,scopes,revoked_at").in("game_id", gameIds),
      supabaseAdmin.from("game_result_submissions").select("game_id").in("game_id", gameIds),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (credentialError || submissionError) return NextResponse.json({ error: "Could not load integration readiness" }, { status: 500 });
  const credentialRows = (credentials ?? []) as Array<{ game_id: string; scopes: string[] | null; revoked_at: string | null }>;
  const submissionRows = (submissions ?? []) as Array<{ game_id: string }>;
  const readiness = Object.fromEntries(gameIds.map((gameId: string) => {
    const hasActiveResultsCredential = credentialRows.some((credential) =>
      credential.game_id === gameId && !credential.revoked_at && credential.scopes?.includes("results:write")
    );
    const acceptedResultCount = submissionRows.filter((submission) => submission.game_id === gameId).length;
    return [gameId, { hasActiveResultsCredential, acceptedResultCount, readyToPublish: hasActiveResultsCredential && acceptedResultCount > 0 }];
  }));
  return NextResponse.json({ studios: studios ?? [], games: games ?? [], readiness });
}

export async function PATCH(request: NextRequest) {
  const user = await admin(request);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { studioId?: string; gameId?: string; decision?: string; note?: string } | null;
  const note = body?.note?.trim() ?? "";
  if (note.length > 500) return NextResponse.json({ error: "Review note must be at most 500 characters" }, { status: 400 });
  if (body?.studioId && ['approved', 'rejected', 'suspended'].includes(body.decision ?? "")) {
    const { data: studio, error } = await supabaseAdmin.from("studios").update({ status: body.decision })
      .eq("id", body.studioId).in("status", ["pending_review", "approved", "rejected", "suspended"]).select("*").maybeSingle();
    if (error || !studio) return NextResponse.json({ error: "Studio review transition was rejected" }, { status: 409 });
    await recordStudioAudit({ studioId: studio.id, actorUserId: user.id, eventType: `studio_${body.decision}`, idempotencyKey: `studio_${body.decision}:${studio.id}:${crypto.randomUUID()}`, payload: { note } });
    return NextResponse.json({ studio });
  }
  if (body?.gameId && ['sandbox', 'published', 'rejected', 'suspended'].includes(body.decision ?? "")) {
    const { data: game } = await supabaseAdmin.from("games").select("id,studio_id,integration_status").eq("id", body.gameId).maybeSingle();
    if (!game?.studio_id) return NextResponse.json({ error: "Studio game not found" }, { status: 404 });
    const { data: studio } = await supabaseAdmin.from("studios").select("status").eq("id", game.studio_id).single();
    if (body.decision === "published" && studio?.status !== "approved") return NextResponse.json({ error: "Approve the studio before publishing its game" }, { status: 409 });
    if (body.decision === "published" && !['sandbox', 'published'].includes(game.integration_status)) {
      return NextResponse.json({ error: "Move the game through sandbox before publishing" }, { status: 409 });
    }
    if (body.decision === "published") {
      const [{ count: resultCount, error: resultError }, { count: credentialCount, error: credentialError }] = await Promise.all([
        supabaseAdmin.from("game_result_submissions").select("id", { count: "exact", head: true }).eq("game_id", game.id),
        supabaseAdmin.from("game_api_credentials").select("id", { count: "exact", head: true })
          .eq("game_id", game.id).contains("scopes", ["results:write"]).is("revoked_at", null),
      ]);
      if (resultError || credentialError) return NextResponse.json({ error: "Could not verify integration readiness" }, { status: 500 });
      if (!credentialCount) return NextResponse.json({ error: "Create an active results:write credential before publishing" }, { status: 409 });
      if (!resultCount) return NextResponse.json({ error: "Complete at least one accepted sandbox result before publishing" }, { status: 409 });
    }
    const { data: updated, error } = await supabaseAdmin.from("games").update({ integration_status: body.decision, is_active: body.decision === "published" })
      .eq("id", game.id).in("integration_status", ["submitted", "sandbox", "published", "rejected", "suspended"]).select("*").maybeSingle();
    if (error || !updated) return NextResponse.json({ error: "Game review transition was rejected" }, { status: 409 });
    await recordStudioAudit({ studioId: game.studio_id, gameId: game.id, actorUserId: user.id, eventType: `game_${body.decision}`, idempotencyKey: `game_${body.decision}:${game.id}:${crypto.randomUUID()}`, payload: { note } });
    return NextResponse.json({ game: updated });
  }
  return NextResponse.json({ error: "Invalid review decision" }, { status: 400 });
}
