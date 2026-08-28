import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { settleAndReconcileMatch } from "@/lib/settlement";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { matchId?: string } | null;
  if (!body?.matchId) return NextResponse.json({ error: "matchId is required" }, { status: 400 });

  const { data: match, error } = await supabaseAdmin
    .from("matches")
    .select("id,smart_contract_match_id,player_a_id,player_b_id,status,winner_id")
    .eq("id", body.matchId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.player_a_id !== user.id && match.player_b_id !== user.id) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }
  if (match.status !== "settling" && match.status !== "completed") {
    return NextResponse.json({ error: "Match is not ready for settlement reconciliation" }, { status: 409 });
  }

  try {
    return NextResponse.json(await settleAndReconcileMatch(match, user.id));
  } catch (settlementError) {
    const message = settlementError instanceof Error ? settlementError.message : "Settlement reconciliation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
