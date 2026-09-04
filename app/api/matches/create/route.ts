import { NextRequest, NextResponse } from "next/server";
import { getAddress, keccak256, stringToBytes } from "viem";
import { getCurrentProfile } from "@/lib/auth/server";
import { escrowPublicClient, getEscrowWalletClient, ESCROW_CONTRACT_ADDRESS, skillFiEscrowAbi } from "@/lib/serverEscrow";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordAuditEvent } from "@/lib/audit";
import {
  attachStakeReservation,
  countRecentStakeReservations,
  getStakeReservation,
  releaseStakeReservation,
  reserveStake,
} from "@/lib/risk";
import { BETA_ACCESS_ERROR, hasActiveBetaAccess } from "@/lib/betaPilot";
import { isPilotGameId } from "@/lib/pilotGames";
import { isValueBearingEnabled, VALUE_BEARING_DISABLED_MESSAGE } from "@/lib/security/valueBearing";

export const dynamic = "force-dynamic";

const MAX_MATCH_CREATIONS_PER_10_MINUTES = 5;
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile(request.headers.get("authorization"));
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE });
  }

  const body = (await request.json().catch(() => null)) as { gameId?: string; stakeAmount?: string; idempotencyKey?: string } | null;
  if (!body?.gameId || !body.stakeAmount || !body.idempotencyKey) {
    return NextResponse.json({ error: "gameId, stakeAmount and idempotencyKey are required" }, { status: 400, headers: PRIVATE_NO_STORE });
  }
  if (!/^[0-9a-f-]{36}$/i.test(body.idempotencyKey)) {
    return NextResponse.json({ error: "Invalid idempotencyKey" }, { status: 400, headers: PRIVATE_NO_STORE });
  }

  let stake: bigint;
  try {
    stake = BigInt(body.stakeAmount);
    if (stake <= 0n) throw new Error("invalid stake");
  } catch {
    return NextResponse.json({ error: "stakeAmount must be a positive integer in token base units" }, { status: 400, headers: PRIVATE_NO_STORE });
  }

  if (!profile.wallet_address) {
    return NextResponse.json({ error: "Link an Ethereum wallet before creating a match" }, { status: 400, headers: PRIVATE_NO_STORE });
  }
  const creatorWallet = getAddress(profile.wallet_address);

  const { data: game, error: gameError } = await supabaseAdmin
    .from("games")
    .select("id,slug")
    .eq("id", body.gameId)
    .eq("is_active", true)
    .maybeSingle();

  if (gameError) {
    return NextResponse.json({ error: "Failed to load game" }, { status: 500, headers: PRIVATE_NO_STORE });
  }
  if (!game) {
    return NextResponse.json({ error: "Game not found or inactive" }, { status: 404, headers: PRIVATE_NO_STORE });
  }
  if (isPilotGameId(game.slug)) {
    if (!(await hasActiveBetaAccess(profile.id))) {
      return NextResponse.json({ error: BETA_ACCESS_ERROR }, { status: 403, headers: PRIVATE_NO_STORE });
    }
    return NextResponse.json(
      { error: "Pilot games are not eligible for staked settlement until authoritative server-side result verification is enabled." },
      { status: 409, headers: PRIVATE_NO_STORE }
    );
  }

  const reservationKey = `create:${profile.id}:${body.idempotencyKey}`;
  const existingReservation = await getStakeReservation(reservationKey);
  if (existingReservation) {
    if (existingReservation.user_id !== profile.id || BigInt(existingReservation.amount) !== stake) {
      return NextResponse.json({ error: "Idempotency key conflict" }, { status: 409, headers: PRIVATE_NO_STORE });
    }

    if (existingReservation.match_id) {
      const { data: existingMatch, error: existingMatchError } = await supabaseAdmin
        .from("matches")
        .select("id, smart_contract_match_id, game_id, player_a_id, player_b_id, stake_amount, status")
        .eq("id", existingReservation.match_id)
        .maybeSingle();
      if (existingMatchError) {
        return NextResponse.json({ error: "Existing idempotent match could not be loaded" }, { status: 500, headers: PRIVATE_NO_STORE });
      }
      if (existingMatch) {
        return NextResponse.json({ match: existingMatch, idempotentReplay: true }, { headers: PRIVATE_NO_STORE });
      }
    }

    return NextResponse.json(
      { error: "This idempotency key is already in use. Retry/recovery must not create another on-chain match." },
      { status: 409, headers: PRIVATE_NO_STORE }
    );
  }

  // Allow safe idempotent recovery above even when value-bearing mode is off,
  // but refuse any NEW economic exposure below unless release gates explicitly
  // enabled the switch.
  if (!isValueBearingEnabled()) {
    return NextResponse.json(
      { error: VALUE_BEARING_DISABLED_MESSAGE },
      { status: 503, headers: { ...PRIVATE_NO_STORE, "Retry-After": "300" } },
    );
  }

  const recentCreations = await countRecentStakeReservations(profile.id, 10);
  if (recentCreations >= MAX_MATCH_CREATIONS_PER_10_MINUTES) {
    return NextResponse.json(
      { error: "Too many match creation attempts. Try again later." },
      { status: 429, headers: { ...PRIVATE_NO_STORE, "Retry-After": "600" } }
    );
  }

  const risk = await reserveStake(profile.id, stake, reservationKey);
  if (!risk.allowed) {
    return NextResponse.json({ error: risk.reason, risk }, { status: 429, headers: PRIVATE_NO_STORE });
  }
  if (risk.reason !== "reserved") {
    return NextResponse.json(
      { error: "Idempotent reservation already exists; refusing to spend operator gas twice." },
      { status: 409, headers: PRIVATE_NO_STORE }
    );
  }

  const matchId = BigInt(keccak256(stringToBytes(`${profile.id}:${Date.now()}:${crypto.randomUUID()}`)));
  const escrowWalletClient = getEscrowWalletClient();
  let hash: `0x${string}`;
  try {
    hash = await escrowWalletClient.writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: skillFiEscrowAbi,
      functionName: "createMatch",
      args: [matchId, stake, creatorWallet],
    });
  } catch (error) {
    await releaseStakeReservation(reservationKey);
    throw error;
  }

  const receipt = await escrowPublicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    await releaseStakeReservation(reservationKey);
    return NextResponse.json({ error: "On-chain match creation reverted" }, { status: 502, headers: PRIVATE_NO_STORE });
  }

  const { data: match, error: insertError } = await supabaseAdmin
    .from("matches")
    .insert({
      smart_contract_match_id: matchId.toString(),
      game_id: game.id,
      player_a_id: profile.id,
      player_b_id: null,
      stake_amount: stake.toString(),
      status: "waiting_on_chain",
    })
    .select("id, smart_contract_match_id, game_id, player_a_id, player_b_id, stake_amount, status")
    .single();

  if (insertError) {
    return NextResponse.json({ error: "On-chain match exists but database indexing failed", txHash: hash }, { status: 502, headers: PRIVATE_NO_STORE });
  }

  await attachStakeReservation(reservationKey, match.id);

  await recordAuditEvent({
    matchId: match.id,
    actorUserId: profile.id,
    eventType: "match_created",
    txHash: hash,
    idempotencyKey: `match_created:${hash.toLowerCase()}`,
    payload: { smartContractMatchId: match.smart_contract_match_id, stakeAmount: match.stake_amount },
  });

  return NextResponse.json({ match, txHash: hash }, { headers: PRIVATE_NO_STORE });
}
