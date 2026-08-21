import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { verifyPrivyAccessToken } from "@/lib/privy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { escrowPublicClient, escrowWalletClient, ESCROW_CONTRACT_ADDRESS, skillFiEscrowAbi } from "@/lib/serverEscrow";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const privyUserId = await verifyPrivyAccessToken(request.headers.get("authorization"));
  if (!privyUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { matchId?: string; txHash?: `0x${string}` } | null;
  if (!body?.matchId || !body.txHash) return NextResponse.json({ error: "matchId and txHash are required" }, { status: 400 });

  let matchId: bigint;
  try { matchId = BigInt(body.matchId); } catch { return NextResponse.json({ error: "Invalid matchId" }, { status: 400 }); }

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, wallet_address")
    .eq("privy_user_id", privyUserId)
    .maybeSingle();
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!user?.wallet_address) return NextResponse.json({ error: "Wallet is not linked" }, { status: 400 });

  const receipt = await escrowPublicClient.getTransactionReceipt({ hash: body.txHash });
  if (receipt.status !== "success") return NextResponse.json({ error: "Join transaction reverted" }, { status: 400 });
  if (getAddress(receipt.from) !== getAddress(user.wallet_address)) {
    return NextResponse.json({ error: "Join transaction sender does not match authenticated wallet" }, { status: 403 });
  }

  const onchain = await escrowPublicClient.readContract({
    address: ESCROW_CONTRACT_ADDRESS,
    abi: skillFiEscrowAbi,
    functionName: "matches",
    args: [matchId],
  });

  const player1 = getAddress(onchain[0]);
  const player2 = getAddress(onchain[1]);
  const caller = getAddress(user.wallet_address);
  if (caller !== player1 && caller !== player2) {
    return NextResponse.json({ error: "Wallet is not a participant in this match" }, { status: 403 });
  }

  const { data: dbMatch, error: dbError } = await supabaseAdmin
    .from("matches")
    .select("id, player_a_id, player_b_id, status")
    .eq("smart_contract_match_id", matchId.toString())
    .maybeSingle();
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  if (!dbMatch) return NextResponse.json({ error: "Match not indexed" }, { status: 404 });

  const updates: Record<string, string> = {};
  if (caller === player2 && !dbMatch.player_b_id) updates.player_b_id = user.id;

  // V2 status 2 = READY. The operator is the only account allowed to start.
  if (Number(onchain[6]) === 2) {
    const startHash = await escrowWalletClient.writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: skillFiEscrowAbi,
      functionName: "startMatch",
      args: [matchId],
    });
    const startReceipt = await escrowPublicClient.waitForTransactionReceipt({ hash: startHash });
    if (startReceipt.status !== "success") {
      return NextResponse.json({ error: "Both players joined, but the operator could not start the match" }, { status: 502 });
    }
    updates.status = "active";
  }

  if (Object.keys(updates).length) {
    const { error: updateError } = await supabaseAdmin.from("matches").update(updates).eq("id", dbMatch.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, matchId: matchId.toString(), status: updates.status ?? dbMatch.status });
}
