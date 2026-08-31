import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { isPilotGameId } from "@/lib/pilotGames";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ runs: [] });
  const { data, error } = await supabaseAdmin.from("beta_pilot_game_runs").select("game_slug,score_percent,duration_ms,feedback_rating,feedback_note,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load pilot runs" }, { status: 500 });
  return NextResponse.json({ runs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Sign in before saving a pilot result" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { gameSlug?: string; scorePercent?: number; durationMs?: number; feedbackRating?: number | null; feedbackNote?: string } | null;
  const note = body?.feedbackNote?.trim().replace(/\s+/g, " ") ?? "";
  if (!isPilotGameId(body?.gameSlug) || !Number.isInteger(body?.scorePercent) || body!.scorePercent! < 0 || body!.scorePercent! > 100 || !Number.isInteger(body?.durationMs) || body!.durationMs! < 1000 || body!.durationMs! > 600000 || (body?.feedbackRating != null && (!Number.isInteger(body.feedbackRating) || body.feedbackRating < 1 || body.feedbackRating > 5)) || note.length > 1000) {
    return NextResponse.json({ error: "Invalid pilot result" }, { status: 400 });
  }
  const { data: enrollment, error: enrollmentError } = await supabaseAdmin.from("beta_pilot_enrollments").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (enrollmentError || !enrollment) return NextResponse.json({ error: "Active beta access is required to save pilot results" }, { status: 403 });
  const { data, error } = await supabaseAdmin.from("beta_pilot_game_runs").upsert({
    enrollment_id: enrollment.id,
    user_id: user.id,
    game_slug: body!.gameSlug,
    score_percent: body!.scorePercent,
    duration_ms: body!.durationMs,
    feedback_rating: body?.feedbackRating ?? null,
    feedback_note: note,
  }, { onConflict: "user_id,game_slug" }).select("game_slug,score_percent,duration_ms,feedback_rating,feedback_note,updated_at").single();
  if (error) return NextResponse.json({ error: "Could not save pilot result" }, { status: 500 });
  return NextResponse.json({ run: data });
}
