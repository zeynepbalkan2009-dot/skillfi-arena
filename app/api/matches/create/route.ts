import { NextRequest, NextResponse } from "next/server";
import { keccak256, stringToBytes } from "viem";
import { getCurrentProfile } from "@/lib/auth/server";
import { escrowPublicClient, getEscrowWalletClient, ESCROW_CONTRACT_ADDRESS, skillFiEscrowAbi } from "@/lib/serverEscrow";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordAuditEvent } from "@/lib/audit";
import { attachStakeReservation, releaseStakeReservation, reserveStake } from "@/lib/risk";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile(request.headers.get("authorization"));
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { gameId?: string; stakeAmount?: string; idempotencyKey?: string } | null;
  if (!body?.gameId || !body.stakeAmount || !body.idempotencyKey) {
    return NextResponse.json({ error: "gameId, stakeAmount and idempotencyKey are required" }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(body.idempotencyKey)) {
    return NextResponse.json({ error: "Invalid idempotencyKey" }, { status: 400 });
  }

  let stake: bigint;
  try {
    stake = BigInt(body.stakeAmount);
    if (stake <= 0n) throw new Error("invalid stake");
  } catch {
    return NextResponse.json({ error: "stakeAmount must be a positive integer in token base units" }, { status: 400 });
  }

  if (!profile.wallet_address) {
    return NextResponse.json({ error: "Link an Ethereum wallet before creating a match" }, { status: 400 });
  }

  const { data: game, error: gameError } = await supabaseAdmin
    .from("games")
    .select("id")
    .eq("id", body.gameId)
    .eq("is_active", true)
    .maybeSingle();

  if (gameError) {
    return NextResponse.json({ error: "Failed to load game" }, { status: 500 });
  }
  if (!game) {
    return NextResponse.json({ error: "Game not found or inactive" }, { status: 404 });
  }

  const reservationKey = `create:${profile.id}:${body.idempotencyKey}`;
  const risk = await reserveStake(profile.id, stake, reservationKey);
  if (!risk.allowed) {
    return NextResponse.json({ error: risk.reason, risk }, { status: 429 });
  }

  const matchId = BigInt(keccak256(stringToBytes(`${profile.id}:${Date.now()}:${crypto.randomUUID()}`)));
  const escrowWalletClient = getEscrowWalletClient();
  let hash: `0x${string}`;
  try {
    hash = await escrowWalletClient.writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: skillFiEscrowAbi,
      functionName: "createMatch",
      args: [matchId, stake],
    });
  } catch (error) {
    await releaseStakeReservation(reservationKey);
    throw error;
  }
  const receipt = await escrowPublicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    await releaseStakeReservation(reservationKey);
    return NextResponse.json({ error: "On-chain match creation reverted" }, { status: 502 });
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
    return NextResponse.json({ error: "On-chain match exists but database indexing failed", txHash: hash }, { status: 502 });
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

  return NextResponse.json({ match, txHash: hash });
}
