import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { MatchDisputedError, SettlementInProgressError, settleAndReconcileMatch } from "@/lib/settlement";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE });

  const body = (await request.json().catch(() => null)) as { matchId?: string } | null;
  if (!body?.matchId) return NextResponse.json({ error: "matchId is required" }, { status: 400, headers: PRIVATE_NO_STORE });

  const { data: match, error } = await supabaseAdmin
    .from("matches")
    .select("id,smart_contract_match_id,player_a_id,player_b_id,status,winner_id")
    .eq("id", body.matchId)
    .maybeSingle();
  if (error) {
    console.error("Settlement reconcile match lookup failed:", error.message);
    return NextResponse.json({ error: "Could not load match" }, { status: 500, headers: PRIVATE_NO_STORE });
  }
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404, headers: PRIVATE_NO_STORE });
  if (match.player_a_id !== user.id && match.player_b_id !== user.id) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403, headers: PRIVATE_NO_STORE });
  }
  if (match.status !== "settling" && match.status !== "completed") {
    return NextResponse.json({ error: "Match is not ready for settlement reconciliation" }, { status: 409, headers: PRIVATE_NO_STORE });
  }

  try {
    return NextResponse.json(await settleAndReconcileMatch(match, user.id), { headers: PRIVATE_NO_STORE });
  } catch (settlementError) {
    if (settlementError instanceof SettlementInProgressError) {
      return NextResponse.json({ status: "settling" }, { status: 202, headers: PRIVATE_NO_STORE });
    }
    if (settlementError instanceof MatchDisputedError) {
      return NextResponse.json({ error: settlementError.message, status: "disputed" }, { status: 409, headers: PRIVATE_NO_STORE });
    }
    console.error("Settlement reconciliation failed:", settlementError instanceof Error ? settlementError.message : settlementError);
    return NextResponse.json({ error: "Settlement reconciliation failed" }, { status: 502, headers: PRIVATE_NO_STORE });
  }
}
