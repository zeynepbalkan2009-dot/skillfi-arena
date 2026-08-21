import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { verifyPrivyAccessToken } from "@/lib/privy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { escrowPublicClient, escrowWalletClient, ESCROW_CONTRACT_ADDRESS, skillFiEscrowAbi } from "@/lib/serverEscrow";
import { passageForMatch, scoreTyping } from "@/lib/typingGame";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const privyUserId = await verifyPrivyAccessToken(request.headers.get("authorization"));
  if (!privyUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { matchId?: string; typedText?: string; elapsedMs?: number } | null;
  if (!body?.matchId || typeof body.typedText !== "string" || typeof body.elapsedMs !== "number") {
    return NextResponse.json({ error: "matchId, typedText and elapsedMs are required" }, { status: 400 });
  }

  const { data: user, error: userError } = await supabaseAdmin.from("users").select("id, wallet_address").eq("privy_user_id", privyUserId).maybeSingle();
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: "SkillFi account not found" }, { status: 404 });

  const { data: match, error: matchError } = await supabaseAdmin.from("matches").select("id, smart_contract_match_id, player_a_id, player_b_id, status").eq("smart_contract_match_id", body.matchId).maybeSingle();
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.player_a_id !== user.id && match.player_b_id !== user.id) return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  if (match.status !== "active" && match.status !== "settling") return NextResponse.json({ error: "Match is not accepting results" }, { status: 409 });

  const passage = passageForMatch(body.matchId);
  if (body.typedText.length > passage.length) return NextResponse.json({ error: "Submission is longer than the deterministic passage" }, { status: 400 });
  const score = scoreTyping(passage, body.typedText, body.elapsedMs);

  const { error: submissionError } = await supabaseAdmin.from("match_submissions").upsert({
    match_id: match.id,
    user_id: user.id,
    typed_text: body.typedText,
    elapsed_ms: score.elapsedMs,
    typed_chars: score.typedChars,
    correct_chars: score.correctChars,
    wpm: score.wpm,
    accuracy: score.accuracy,
  }, { onConflict: "match_id,user_id" });
  if (submissionError) return NextResponse.json({ error: submissionError.message }, { status: 500 });

  const { data: submissions, error: submissionsError } = await supabaseAdmin.from("match_submissions").select("user_id, correct_chars, accuracy, wpm, elapsed_ms").eq("match_id", match.id);
  if (submissionsError) return NextResponse.json({ error: submissionsError.message }, { status: 500 });
  if ((submissions?.length ?? 0) < 2) return NextResponse.json({ status: "waiting_for_opponent", score });

  const ranked = [...(submissions ?? [])].sort((a, b) => {
    if (b.correct_chars !== a.correct_chars) return b.correct_chars - a.correct_chars;
    if (Number(b.accuracy) !== Number(a.accuracy)) return Number(b.accuracy) - Number(a.accuracy);
    return Number(b.wpm) - Number(a.wpm);
  });
  const winnerId = ranked[0].user_id;

  await supabaseAdmin.from("matches").update({ status: "settling", winner_id: winnerId }).eq("id", match.id).in("status", ["active", "settling"]);

  const matchId = BigInt(body.matchId);
  const onchain = await escrowPublicClient.readContract({ address: ESCROW_CONTRACT_ADDRESS, abi: skillFiEscrowAbi, functionName: "matches", args: [matchId] });
  const winnerWallet = (winnerId === match.player_a_id ? onchain[0] : onchain[1]) as `0x${string}`;

  // Status 3 = IN_PROGRESS, 4 = RESOLVED.
  if (Number(onchain[6]) === 3) {
    const settlementHash = await escrowWalletClient.writeContract({ address: ESCROW_CONTRACT_ADDRESS, abi: skillFiEscrowAbi, functionName: "resolveMatch", args: [matchId, winnerWallet] });
    const settlementReceipt = await escrowPublicClient.waitForTransactionReceipt({ hash: settlementHash });
    if (settlementReceipt.status !== "success") return NextResponse.json({ error: "Settlement transaction reverted", status: "settling" }, { status: 502 });
  } else if (Number(onchain[6]) !== 4) {
    return NextResponse.json({ error: `Unexpected on-chain match state ${Number(onchain[6])}` }, { status: 409 });
  }

  const { error: completeError } = await supabaseAdmin.from("matches").update({ status: "completed", winner_id: winnerId }).eq("id", match.id);
  if (completeError) return NextResponse.json({ error: completeError.message }, { status: 500 });

  return NextResponse.json({ status: "completed", winnerId, score });
}
