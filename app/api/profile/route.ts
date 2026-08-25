import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UpdateProfileBody = {
  username?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

function validateUsername(username: string): string {
  const trimmed = username.trim();
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(trimmed)) {
    throw new Error("Username must be 3-24 characters and use only letters, numbers, and underscores.");
  }
  return trimmed;
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile(request.headers.get("authorization"));
  if (!profile) {
    return NextResponse.json({ error: "Invalid or missing Privy access token" }, { status: 401 });
  }
  return NextResponse.json({ user: profile }, { status: 200 });
}

export async function PATCH(request: NextRequest) {
  const profile = await getCurrentProfile(request.headers.get("authorization"));
  if (!profile) {
    return NextResponse.json({ error: "Invalid or missing Privy access token" }, { status: 401 });
  }

  let body: UpdateProfileBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, string | null> = {};
  try {
    if (body.username !== undefined) update.username = validateUsername(body.username);
    if (body.displayName !== undefined) update.display_name = body.displayName?.trim() || null;
    if (body.avatarUrl !== undefined) update.avatar_url = body.avatarUrl?.trim() || null;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid profile" }, { status: 422 });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable profile fields supplied" }, { status: 422 });
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .update(update)
    .eq("id", profile.id)
    .select(
      "id, privy_user_id, username, display_name, avatar_url, region, email, wallet_address, primary_wallet_address, wins, losses, matches_played, elo_rating, total_earnings, created_at, last_login_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: "Profile update conflict" }, { status: 409 });
  }

  return NextResponse.json({ user: data }, { status: 200 });
}
