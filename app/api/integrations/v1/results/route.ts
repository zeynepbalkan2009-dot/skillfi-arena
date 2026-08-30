import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { recordAuditEvent } from "@/lib/audit";
import { authenticateGameApiKey, readBearerSecret, verifyGameRequestSignature } from "@/lib/gameCredentials";
import { settleAndReconcileMatch } from "@/lib/settlement";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ResultBody = { eventId?: string; matchId?: string; winnerWallet?: string; occurredAt?: string };

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declaredLength) || declaredLength > 16_384) return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  const authorization = request.headers.get("authorization");
  const secret = readBearerSecret(authorization);
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 16_384) return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  if (!secret || !verifyGameRequestSignature(secret, request.headers.get("x-skillfi-timestamp"), rawBody, request.headers.get("x-skillfi-signature"))) {
    return NextResponse.json({ error: "Invalid or expired request signature" }, { status: 401 });
  }
  const credential = await authenticateGameApiKey(authorization, "results:write");
  if (!credential) return NextResponse.json({ error: "Invalid, expired, revoked, or insufficient integration key" }, { status: 401 });
  let body: ResultBody;
  try { body = JSON.parse(rawBody) as ResultBody; }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const eventId = body.eventId?.trim() ?? "";
  if (!/^[a-zA-Z0-9:_-]{8,100}$/.test(eventId) || !body.matchId || !body.winnerWallet || !body.occurredAt) {
    return NextResponse.json({ error: "eventId, matchId, winnerWallet and occurredAt are required" }, { status: 400 });
  }
  const occurredAt = new Date(body.occurredAt);
  if (!Number.isFinite(occurredAt.getTime()) || Math.abs(Date.now() - occurredAt.getTime()) > 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "occurredAt must be within 24 hours" }, { status: 400 });
  }
  let winnerWallet: `0x${string}`;
  try { winnerWallet = getAddress(body.winnerWallet); }
  catch { return NextResponse.json({ error: "winnerWallet is invalid" }, { status: 400 }); }

  const { data: game } = await supabaseAdmin.from("games").select("id,studio_id,integration_status").eq("id", credential.game_id).eq("studio_id", credential.studio_id).maybeSingle();
  if (!game || !['sandbox', 'published'].includes(game.integration_status)) return NextResponse.json({ error: "Game integration is not active" }, { status: 409 });
  if (game.integration_status === "published" && !credential.key_prefix.startsWith("sk_live_")) {
    return NextResponse.json({ error: "Published games require a live integration key" }, { status: 401 });
  }
  const { data: match, error: matchError } = await supabaseAdmin.from("matches")
    .select("id,smart_contract_match_id,game_id,player_a_id,player_b_id,status,winner_id").eq("id", body.matchId).maybeSingle();
  if (matchError || !match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.game_id !== game.id) return NextResponse.json({ error: "Credential cannot submit results for this game" }, { status: 403 });
  if (!match.player_b_id || !['active', 'settling', 'completed'].includes(match.status)) return NextResponse.json({ error: "Match is not ready for an external result" }, { status: 409 });
  const isSandboxMatch = game.integration_status === "sandbox" && !match.smart_contract_match_id;
  if (!isSandboxMatch && !match.smart_contract_match_id) return NextResponse.json({ error: "Published game results require an on-chain match" }, { status: 409 });
  const { data: players, error: playerError } = await supabaseAdmin.from("users").select("id,wallet_address").in("id", [match.player_a_id, match.player_b_id]);
  if (playerError || players?.length !== 2) return NextResponse.json({ error: "Match participants are unavailable" }, { status: 409 });
  const playerRows = players as Array<{ id: string; wallet_address: string | null }>;
  const winner = playerRows.find((player) => player.wallet_address && getAddress(player.wallet_address) === winnerWallet);
  if (!winner) return NextResponse.json({ error: "Winner wallet is not a match participant" }, { status: 400 });
  const payloadHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  const submission = { game_id: game.id, studio_id: game.studio_id, credential_id: credential.id, match_id: match.id, event_id: eventId, winner_user_id: winner.id, payload_hash: payloadHash, source_occurred_at: occurredAt.toISOString() };
  const { error: insertError } = await supabaseAdmin.from("game_result_submissions").insert(submission);
  if (insertError?.code === "23505") {
    const { data: existing } = await supabaseAdmin.from("game_result_submissions").select("game_id,match_id,event_id,winner_user_id,payload_hash").eq("match_id", match.id).maybeSingle();
    if (!existing || existing.game_id !== game.id || existing.event_id !== eventId || existing.winner_user_id !== winner.id || existing.payload_hash !== payloadHash) {
      return NextResponse.json({ error: "Result event or match was already used with different data" }, { status: 409 });
    }
  } else if (insertError) return NextResponse.json({ error: "Could not record result submission" }, { status: 500 });

  if (match.status !== "completed") {
    const { error: updateError } = await supabaseAdmin.from("matches").update({ winner_id: winner.id, status: "settling" })
      .eq("id", match.id).in("status", ["active", "settling"]);
    if (updateError) return NextResponse.json({ error: "Could not lock external result" }, { status: 500 });
  }
  await recordAuditEvent({ matchId: match.id, actorUserId: null, eventType: "external_result_accepted", idempotencyKey: `external_result_accepted:${game.id}:${eventId}`, payload: { studioId: game.studio_id, gameId: game.id, credentialId: credential.id, winnerId: winner.id, payloadHash, occurredAt: occurredAt.toISOString() } });
  if (isSandboxMatch) {
    const { error: completeError } = await supabaseAdmin.from("matches").update({ status: "completed", winner_id: winner.id })
      .eq("id", match.id).eq("winner_id", winner.id).in("status", ["settling", "completed"]);
    if (completeError) return NextResponse.json({ error: "Could not complete sandbox match" }, { status: 500 });
    await recordAuditEvent({ matchId: match.id, actorUserId: null, eventType: "sandbox_match_completed", idempotencyKey: `sandbox_match_completed:${match.id}`, payload: { studioId: game.studio_id, gameId: game.id, winnerId: winner.id, payout: "0" } });
    return NextResponse.json({ status: "completed", matchId: match.id, winnerId: winner.id, settlementHash: null, sandbox: true });
  }
  const settlement = await settleAndReconcileMatch({ ...match, status: match.status === "completed" ? "completed" : "settling", winner_id: winner.id }, null);
  return NextResponse.json({ status: settlement.status, matchId: match.id, winnerId: winner.id, settlementHash: settlement.settlementHash });
}
