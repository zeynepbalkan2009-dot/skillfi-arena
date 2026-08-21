import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { createInvitationToken, hashInvitationToken } from "@/lib/challenges/tokens";
import { parseUsdcUnits } from "@/lib/env/public";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CreateChallengeBody = {
  gameId?: string;
  entryFee?: string;
  currency?: string;
  opponentMode?: "open" | "invite";
  invitedOpponent?: string;
  rules?: string;
  expirationMinutes?: number;
  idempotencyKey?: string;
};

const MIN_EXPIRATION_MINUTES = 5;
const MAX_EXPIRATION_MINUTES = 60 * 24 * 7;
const MAX_ENTRY_FEE_USDC_UNITS = 1_000_000n * 1_000_000n;

function parseExpiration(minutes: unknown): number {
  const value = typeof minutes === "number" ? minutes : 60;
  if (!Number.isInteger(value) || value < MIN_EXPIRATION_MINUTES || value > MAX_EXPIRATION_MINUTES) {
    throw new Error(`Expiration must be between ${MIN_EXPIRATION_MINUTES} minutes and 7 days.`);
  }
  return value;
}

async function resolveInvitedOpponent(input: string | undefined, creatorId: string) {
  if (!input?.trim()) return null;
  const term = input.trim();

  let query = supabaseAdmin.from("users").select("id, username, email, wallet_address, primary_wallet_address");
  if (/^0x[a-fA-F0-9]{40}$/.test(term)) {
    const wallet = term.toLowerCase();
    query = query.or(`wallet_address.eq.${wallet},primary_wallet_address.eq.${wallet}`);
  } else if (term.includes("@")) {
    query = query.ilike("email", term);
  } else if (/^[a-zA-Z0-9_]{3,24}$/.test(term)) {
    query = query.eq("username", term);
  } else {
    throw new Error("Invited opponent must be a username, email, or EVM wallet address.");
  }

  const { data, error } = await query.limit(2);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Invited opponent was not found.");
  if (data.length > 1) throw new Error("Invited opponent lookup matched more than one player.");
  if (data[0].id === creatorId) throw new Error("You cannot invite yourself.");
  return data[0].id as string;
}

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile(request.headers.get("authorization"));
  if (!profile) {
    return NextResponse.json({ error: "Invalid or missing Privy access token" }, { status: 401 });
  }

  let body: CreateChallengeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.gameId) {
    return NextResponse.json({ error: "gameId is required" }, { status: 422 });
  }
  if (body.currency && body.currency !== "USDC") {
    return NextResponse.json({ error: "Only USDC challenges are supported in this sprint" }, { status: 422 });
  }

  let entryFee: bigint;
  let expirationMinutes: number;
  try {
    entryFee = parseUsdcUnits(body.entryFee ?? "");
    if (entryFee <= 0n) throw new Error("Entry fee must be greater than zero.");
    if (entryFee > MAX_ENTRY_FEE_USDC_UNITS) throw new Error("Entry fee exceeds the current challenge limit.");
    expirationMinutes = parseExpiration(body.expirationMinutes);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid challenge" }, { status: 422 });
  }

  const opponentMode = body.opponentMode ?? "open";
  if (!["open", "invite"].includes(opponentMode)) {
    return NextResponse.json({ error: "opponentMode must be open or invite" }, { status: 422 });
  }

  const { data: game, error: gameError } = await supabaseAdmin
    .from("games")
    .select("id, is_active")
    .eq("id", body.gameId)
    .maybeSingle();

  if (gameError || !game?.is_active) {
    return NextResponse.json({ error: "Unknown or inactive game" }, { status: 422 });
  }

  if (body.idempotencyKey) {
    const { data: existing } = await supabaseAdmin
      .from("challenges")
      .select("*")
      .eq("creator_id", profile.id)
      .eq("idempotency_key", body.idempotencyKey)
      .maybeSingle();
    if (existing) return NextResponse.json({ challenge: existing }, { status: 200 });
  }

  let invitedOpponentId: string | null = null;
  try {
    invitedOpponentId = await resolveInvitedOpponent(body.invitedOpponent, profile.id);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid opponent" }, { status: 422 });
  }

  if (opponentMode === "invite" && !invitedOpponentId) {
    return NextResponse.json({ error: "Invite-only challenges require an invited opponent" }, { status: 422 });
  }
  if (opponentMode === "open" && invitedOpponentId) {
    return NextResponse.json({ error: "Open challenges cannot include an invited opponent" }, { status: 422 });
  }

  const token = createInvitationToken();
  const invitationUrl = new URL(`/challenge/${token}`, request.nextUrl.origin).toString();
  const expiresAt = new Date(Date.now() + expirationMinutes * 60_000).toISOString();
  const rules = body.rules?.trim() || "Standard SkillFi Arena rules";

  const { data: challenge, error: insertError } = await supabaseAdmin
    .from("challenges")
    .insert({
      invitation_token_hash: hashInvitationToken(token),
      idempotency_key: body.idempotencyKey ?? null,
      game_id: body.gameId,
      creator_id: profile.id,
      invited_opponent_id: invitedOpponentId,
      entry_fee: entryFee.toString(),
      currency: "USDC",
      opponent_mode: opponentMode,
      rules,
      status: "open",
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Could not create challenge" }, { status: 500 });
  }

  await supabaseAdmin
    .from("challenge_participants")
    .insert({ challenge_id: challenge.id, user_id: profile.id, role: "creator" })
    .throwOnError();

  return NextResponse.json({ challenge: { ...challenge, invitation_url: invitationUrl } }, { status: 201 });
}
