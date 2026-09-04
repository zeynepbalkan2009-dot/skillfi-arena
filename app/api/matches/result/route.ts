import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPilotRound, isPilotGameId, scorePilotRound } from "@/lib/pilotGames";
import { recordAuditEvent } from "@/lib/audit";
import { MatchDisputedError, SettlementInProgressError, settleAndReconcileMatch } from "@/lib/settlement";

export const dynamic = "force-dynamic";
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE });

  const body = await request.json().catch(() => null) as { matchId?: string; answer?: string; typedText?: string; elapsedMs?: number } | null;
  const answer = body?.answer ?? body?.typedText;
  if (!body?.matchId || typeof answer !== "string") return NextResponse.json({ error: "matchId and answer are required" }, { status: 400, headers: PRIVATE_NO_STORE });
  if (answer.length > 2_000) return NextResponse.json({ error: "Answer is too long" }, { status: 413, headers: PRIVATE_NO_STORE });

  const { data: match, error: matchError } = await supabaseAdmin
    .from("matches")
    .select("id, smart_contract_match_id, player_a_id, player_b_id, status, winner_id, started_at, game:games(slug)")
    .eq("smart_contract_match_id", body.matchId)
    .maybeSingle();
  if (matchError) {
    console.error("Result match lookup failed:", matchError.message);
    return NextResponse.json({ error: "Could not load match" }, { status: 500, headers: PRIVATE_NO_STORE });
  }
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404, headers: PRIVATE_NO_STORE });
  if (match.player_a_id !== user.id && match.player_b_id !== user.id) return NextResponse.json({ error: "Not a participant" }, { status: 403, headers: PRIVATE_NO_STORE });
  if (match.status !== "active") return NextResponse.json({ error: "Match is not accepting new results" }, { status: 409, headers: PRIVATE_NO_STORE });
  if (!match.started_at) return NextResponse.json({ error: "Match has no authoritative start time" }, { status: 409, headers: PRIVATE_NO_STORE });

  const gameRelation = match.game as unknown as { slug?: string | null } | Array<{ slug?: string | null }> | null;
  const gameSlug = Array.isArray(gameRelation) ? gameRelation[0]?.slug : gameRelation?.slug;
  if (!isPilotGameId(gameSlug)) {
    return NextResponse.json(
      { error: "Participant-submitted results are disabled for studio and published games; authoritative integration results are required." },
      { status: 403, headers: PRIVATE_NO_STORE },
    );
  }

  const serverElapsedMs = Math.max(1000, Math.min(60000, Date.now() - new Date(match.started_at).getTime()));
  const pilotRound = createPilotRound(gameSlug, body.matchId);
  const pilotScore = scorePilotRound(pilotRound, answer);
  const score = {
    typedChars: answer.length,
    correctChars: pilotScore.points,
    accuracy: pilotScore.percent / 100,
    wpm: pilotScore.points / (serverElapsedMs / 60000),
    elapsedMs: serverElapsedMs,
  };

  const { error: submissionError } = await supabaseAdmin.from("match_submissions").insert({
    match_id: match.id,
    user_id: user.id,
    typed_text: answer,
    elapsed_ms: score.elapsedMs,
    typed_chars: score.typedChars,
    correct_chars: score.correctChars,
    wpm: score.wpm,
    accuracy: score.accuracy,
  });
  if (submissionError?.code === "23505") {
    return NextResponse.json({ error: "Result already submitted for this match" }, { status: 409, headers: PRIVATE_NO_STORE });
  }
  if (submissionError) {
    console.error("Result submission insert failed:", submissionError.message);
    return NextResponse.json({ error: "Could not record result" }, { status: 500, headers: PRIVATE_NO_STORE });
  }

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

  const { data: submissions, error: submissionsError } = await supabaseAdmin
    .from("match_submissions")
    .select("user_id, correct_chars, accuracy, wpm, elapsed_ms")
    .eq("match_id", match.id);
  if (submissionsError) {
    console.error("Result submissions lookup failed:", submissionsError.message);
    return NextResponse.json({ error: "Could not load match results" }, { status: 500, headers: PRIVATE_NO_STORE });
  }
  if ((submissions?.length ?? 0) < 2) return NextResponse.json({ status: "waiting_for_opponent", score }, { headers: PRIVATE_NO_STORE });

  const ranked = [...(submissions ?? [])].sort((a, b) => b.correct_chars - a.correct_chars || Number(b.accuracy) - Number(a.accuracy) || Number(b.wpm) - Number(a.wpm));
  const winnerId = ranked[0].user_id;
  const { data: settlementMatch, error: decisionError } = await supabaseAdmin
    .from("matches")
    .update({ status: "settling", winner_id: winnerId })
    .eq("id", match.id)
    .eq("status", "active")
    .is("winner_id", null)
    .select("id,smart_contract_match_id,player_a_id,player_b_id,status,winner_id")
    .maybeSingle();
  if (decisionError) {
    console.error("Settlement decision update failed:", decisionError.message);
    return NextResponse.json({ error: "Could not lock settlement decision" }, { status: 500, headers: PRIVATE_NO_STORE });
  }
  if (!settlementMatch) return NextResponse.json({ error: "Settlement decision conflict" }, { status: 409, headers: PRIVATE_NO_STORE });

  await recordAuditEvent({
    matchId: match.id,
    actorUserId: user.id,
    eventType: "settlement_decided",
    idempotencyKey: `settlement_decided:${match.id}`,
    payload: { winnerId, ranking: ranked.map((entry) => entry.user_id) },
  });

  try {
    const settlement = await settleAndReconcileMatch(settlementMatch, user.id);
    return NextResponse.json({ ...settlement, score }, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    if (error instanceof MatchDisputedError) {
      await supabaseAdmin.from("matches").update({ status: "disputed" }).eq("id", match.id);
      return NextResponse.json({ error: error.message, status: "disputed" }, { status: 409, headers: PRIVATE_NO_STORE });
    }
    if (error instanceof SettlementInProgressError) {
      return NextResponse.json({ status: "settling", score }, { status: 202, headers: PRIVATE_NO_STORE });
    }
    console.error("Pilot settlement failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Settlement is pending reconciliation", status: "settling" }, { status: 502, headers: PRIVATE_NO_STORE });
  }
}
