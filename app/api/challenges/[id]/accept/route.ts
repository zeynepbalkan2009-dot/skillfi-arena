import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { hashInvitationToken } from "@/lib/challenges/tokens";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const profile = await getCurrentProfile(request.headers.get("authorization"));
  if (!profile) {
    return NextResponse.json({ error: "Invalid or missing Privy access token" }, { status: 401 });
  }

  let body: { invitationToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.invitationToken) {
    return NextResponse.json({ error: "Invitation token is required" }, { status: 403 });
  }

  const { data: challenge, error: challengeError } = await supabaseAdmin
    .from("challenges")
    .select("id")
    .eq("id", params.id)
    .eq("invitation_token_hash", hashInvitationToken(body.invitationToken))
    .maybeSingle();

  if (challengeError) {
    return NextResponse.json({ error: "Could not validate invitation" }, { status: 500 });
  }
  if (!challenge) {
    return NextResponse.json({ error: "Invalid invitation token" }, { status: 403 });
  }

  const { data: result, error } = await supabaseAdmin
    .rpc("accept_challenge", {
      p_challenge_id: params.id,
      p_player_id: profile.id,
    })
    .single();

  if (error) {
    const message = error.message || "Could not accept challenge";
    const status = /not found/i.test(message) ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }

  const matchId = (result as { match_id: string }).match_id;
  const { data: match, error: matchError } = await supabaseAdmin
    .from("matches")
    .select(
      "*, game:games(*), player_a:users!matches_player_a_id_fkey(id, username, display_name, avatar_url, region, wallet_address, primary_wallet_address), player_b:users!matches_player_b_id_fkey(id, username, display_name, avatar_url, region, wallet_address, primary_wallet_address)"
    )
    .eq("id", matchId)
    .single();

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  }

  return NextResponse.json({ match }, { status: 200 });
}
