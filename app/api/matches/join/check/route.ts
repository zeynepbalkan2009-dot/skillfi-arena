import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { attachStakeReservation, reserveStake } from "@/lib/risk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { matchId?: string } | null;
  if (!body?.matchId) return NextResponse.json({ error: "matchId is required" }, { status: 400 });

  const { data: match, error } = await supabaseAdmin
    .from("matches")
    .select("id,player_a_id,player_b_id,stake_amount,status")
    .eq("smart_contract_match_id", body.matchId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load match" }, { status: 500 });
  if (!match || match.status !== "searching") return NextResponse.json({ error: "Match is not open" }, { status: 409 });
  if (match.player_a_id === user.id) return NextResponse.json({ error: "You already own this match" }, { status: 409 });

  const reservationKey = `join:${match.id}:${user.id}`;
  const risk = await reserveStake(user.id, BigInt(match.stake_amount), reservationKey);
  if (!risk.allowed) return NextResponse.json({ error: risk.reason, risk }, { status: 429 });
  await attachStakeReservation(reservationKey, match.id);
  return NextResponse.json({ ok: true, risk });
}
