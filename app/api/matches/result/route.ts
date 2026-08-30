import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { passageForMatch, scoreTyping } from "@/lib/typingGame";
import { createPilotRound, isPilotGameId, scorePilotRound } from "@/lib/pilotGames";
import { recordAuditEvent } from "@/lib/audit";
import { MatchDisputedError, settleAndReconcileMatch } from "@/lib/settlement";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { matchId?: string; answer?: string; typedText?: string; elapsedMs?: number } | null;
  const answer = body?.answer ?? body?.typedText;
  if (!body?.matchId || typeof answer !== "string") return NextResponse.json({ error: "matchId and answer are required" }, { status: 400 });
  if (answer.length > 2_000) return NextResponse.json({ error: "Answer is too long" }, { status: 413 });

  const { data: match, error: matchError } = await supabaseAdmin.from("matches").select("id, smart_contract_match_id, player_a_id, player_b_id, status, winner_id, started_at, game:games(slug)").eq("smart_contract_match_id", body.matchId).maybeSingle();
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.player_a_id !== user.id && match.player_b_id !== user.id) return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  if (match.status !== "active" && match.status !== "settling") return NextResponse.json({ error: "Match is not accepting results" }, { status: 409 });
  if (!match.started_at) return NextResponse.json({ error: "Match has no authoritative start time" }, { status: 409 });

  const serverElapsedMs = Math.max(1000, Math.min(60000, Date.now() - new Date(match.started_at).getTime()));
  const gameRelation = match.game as unknown as { slug?: string | null } | Array<{ slug?: string | null }> | null;
  const gameSlug = Array.isArray(gameRelation) ? gameRelation[0]?.slug : gameRelation?.slug;
  const pilotRound = isPilotGameId(gameSlug) ? createPilotRound(gameSlug, body.matchId) : null;
  const passage = passageForMatch(body.matchId);
  if (!pilotRound && answer.length > passage.length) return NextResponse.json({ error: "Submission is longer than the deterministic passage" }, { status: 400 });
  const pilotScore = pilotRound ? scorePilotRound(pilotRound, answer) : null;
  const typingScore = scoreTyping(passage, answer, serverElapsedMs);
  const score = pilotScore
    ? { typedChars: answer.length, correctChars: pilotScore.points, accuracy: pilotScore.percent / 100, wpm: pilotScore.points / (serverElapsedMs / 60000), elapsedMs: serverElapsedMs }
    : typingScore;

  const { error: submissionError } = await supabaseAdmin.from("match_submissions").upsert({
    match_id: match.id, user_id: user.id, typed_text: answer, elapsed_ms: score.elapsedMs,
    typed_chars: score.typedChars, correct_chars: score.correctChars, wpm: score.wpm, accuracy: score.accuracy,
  }, { onConflict: "match_id,user_id" });
  if (submissionError) return NextResponse.json({ error: submissionError.message }, { status: 500 });

  await recordAuditEvent({
    matchId: match.id,
    actorUserId: user.id,
    eventType: "result_submitted",
    idempotencyKey: `result_submitted:${match.id}:${user.id}`,
    payload: {
      correctChars: score.correctChars,
      typedChars: score.typedChars,
      wpm: score.wpm,
      accuracy: score.accuracy,
      elapsedMs: score.elapsedMs,
    },
  });

  const { data: submissions, error: submissionsError } = await supabaseAdmin.from("match_submissions").select("user_id, correct_chars, accuracy, wpm, elapsed_ms").eq("match_id", match.id);
  if (submissionsError) return NextResponse.json({ error: submissionsError.message }, { status: 500 });
  if ((submissions?.length ?? 0) < 2) return NextResponse.json({ status: "waiting_for_opponent", score });

  const ranked = [...(submissions ?? [])].sort((a, b) => b.correct_chars - a.correct_chars || Number(b.accuracy) - Number(a.accuracy) || Number(b.wpm) - Number(a.wpm));
  const winnerId = ranked[0].user_id;
  const { data: settlementMatch, error: decisionError } = await supabaseAdmin
    .from("matches")
    .update({ status: "settling", winner_id: winnerId })
    .eq("id", match.id)
    .in("status", ["active", "settling"])
    .or(`winner_id.is.null,winner_id.eq.${winnerId}`)
    .select("id,smart_contract_match_id,player_a_id,player_b_id,status,winner_id")
    .maybeSingle();
  if (decisionError) return NextResponse.json({ error: decisionError.message }, { status: 500 });
  if (!settlementMatch) return NextResponse.json({ error: "Settlement decision conflict" }, { status: 409 });

  await recordAuditEvent({
    matchId: match.id,
    actorUserId: user.id,
    eventType: "settlement_decided",
    idempotencyKey: `settlement_decided:${match.id}`,
    payload: { winnerId, ranking: ranked.map((entry) => entry.user_id) },
  });

  try {
    const settlement = await settleAndReconcileMatch(settlementMatch, user.id);
    return NextResponse.json({ ...settlement, score });
  } catch (error) {
    if (error instanceof MatchDisputedError) {
      await supabaseAdmin.from("matches").update({ status: "disputed" }).eq("id", match.id);
      return NextResponse.json({ error: error.message, status: "disputed" }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Settlement failed";
    return NextResponse.json({ error: message, status: "settling" }, { status: 502 });
  }
}
