import { NextRequest, NextResponse } from "next/server";
import { keccak256, stringToBytes } from "viem";
import { getCurrentProfile } from "@/lib/auth/server";
import { escrowPublicClient, getEscrowWalletClient, ESCROW_CONTRACT_ADDRESS, skillFiEscrowAbi } from "@/lib/serverEscrow";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile(request.headers.get("authorization"));
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { gameId?: string; stakeAmount?: string } | null;
  if (!body?.gameId || !body.stakeAmount) {
    return NextResponse.json({ error: "gameId and stakeAmount are required" }, { status: 400 });
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

  const matchId = BigInt(keccak256(stringToBytes(`${profile.id}:${Date.now()}:${crypto.randomUUID()}`)));
  const escrowWalletClient = getEscrowWalletClient();
  const hash = await escrowWalletClient.writeContract({
    address: ESCROW_CONTRACT_ADDRESS,
    abi: skillFiEscrowAbi,
    functionName: "createMatch",
    args: [matchId, stake],
  });
  const receipt = await escrowPublicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
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

  return NextResponse.json({ match, txHash: hash });
}
