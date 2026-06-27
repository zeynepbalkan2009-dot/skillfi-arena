import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, decodeEventLog } from "viem";
import { ACTIVE_CHAIN, ESCROW_CONTRACT_ADDRESS } from "@/lib/contracts";
import { skillFiEscrowAbi } from "@/lib/abi/skillFiEscrow";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyPrivyAccessToken } from "@/lib/privy";

/**
 * Two independent trust checks happen in this route, neither of which can
 * substitute for the other:
 *
 * 1. WHO is calling? Verified server-side against Privy (lib/privy.ts) —
 *    this was missing entirely in an earlier draft of this route, which
 *    trusted the Authorization header without checking it against
 *    anything. A request with no valid Privy access token is rejected
 *    before any chain or DB work happens.
 *
 * 2. DID A REAL DEPOSIT HAPPEN? Verified independently against the chain
 *    by re-fetching the transaction receipt and decoding the
 *    `MatchCreated` event — this was the original security boundary built
 *    for this route and is NOT replaceable by caller authentication
 *    alone. Knowing *who* is asking doesn't tell you whether the
 *    `matchId`/`stakeAmount` they're claiming actually correspond to a
 *    confirmed on-chain escrow deposit; only asking an RPC node does. A
 *    second earlier draft of this route dropped this check and trusted
 *    client-submitted matchId/stakeAmount directly — that reopens the
 *    exact fund-forgery hole this verification step exists to close: a
 *    logged-in user could otherwise claim any matchId/stakeAmount and
 *    create a phantom `searching` match with no real stake behind it.
 *
 * Both checks must pass. Step 1 establishes a SkillFi identity for
 * logging/abuse-prevention purposes; step 2 establishes the actual fact
 * being written to the database. The depositor resolved from the chain
 * event (step 2) is who gets credited as player_a — not necessarily the
 * Privy-authenticated caller from step 1, since nothing requires the
 * caller to be the same wallet that deposited (e.g. a relayer pattern).
 * If you want to *require* caller === depositor, compare the verified
 * Privy user's linked wallet address against `playerA` below.
 */

const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(process.env.RPC_URL),
});

interface CreateMatchRequestBody {
  txHash: `0x${string}`;
  matchId: `0x${string}`;
  gameId: string;
}

export async function POST(request: NextRequest) {
  // --- 0. Who is calling? ---
  const privyUserId = await verifyPrivyAccessToken(request.headers.get("authorization"));
  if (!privyUserId) {
    return NextResponse.json({ error: "Invalid or missing Privy access token" }, { status: 401 });
  }

  let body: CreateMatchRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { txHash, matchId, gameId } = body;
  if (!txHash || !matchId || !gameId) {
    return NextResponse.json({ error: "txHash, matchId, and gameId are required" }, { status: 400 });
  }

  // --- 1. The game must exist and be active before we do any chain work ---
  const { data: game, error: gameError } = await supabaseAdmin
    .from("games")
    .select("id, is_active")
    .eq("id", gameId)
    .maybeSingle();

  if (gameError || !game || !game.is_active) {
    return NextResponse.json({ error: "Unknown or inactive game" }, { status: 400 });
  }

  // --- 2. Independently verify the deposit transaction against the chain ---
  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    return NextResponse.json(
      { error: "Transaction not found yet — it may still be pending. Try again shortly." },
      { status: 404 }
    );
  }

  if (receipt.status !== "success") {
    return NextResponse.json({ error: "Transaction reverted on-chain" }, { status: 400 });
  }

  const decodedMatchCreated = receipt.logs
    .filter((log) => log.address.toLowerCase() === ESCROW_CONTRACT_ADDRESS.toLowerCase())
    .map((log) => {
      try {
        return decodeEventLog({ abi: skillFiEscrowAbi, data: log.data, topics: log.topics });
      } catch {
        return null; // a log that isn't shaped like one of our ABI's events
      }
    })
    .find((decoded) => decoded?.eventName === "MatchCreated");

  if (!decodedMatchCreated) {
    return NextResponse.json(
      { error: "No MatchCreated event found in this transaction for the configured escrow contract" },
      { status: 400 }
    );
  }

  const { matchId: onChainMatchId, playerA, entryFee } = decodedMatchCreated.args;

  if (onChainMatchId.toLowerCase() !== matchId.toLowerCase()) {
    return NextResponse.json({ error: "matchId does not match the on-chain event" }, { status: 400 });
  }

  // --- 3. Resolve the verified depositor wallet to a SkillFi account. ---
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("id")
    .ilike("wallet_address", playerA)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "No SkillFi account is linked to this wallet address yet" },
      { status: 404 }
    );
  }

  // --- 4. Idempotency: a retried request for an already-indexed match
  //        returns the existing row instead of erroring on the unique
  //        constraint. ---
  const { data: existingMatch } = await supabaseAdmin
    .from("matches")
    .select("*")
    .eq("smart_contract_match_id", matchId)
    .maybeSingle();

  if (existingMatch) {
    return NextResponse.json({ match: existingMatch }, { status: 200 });
  }

  // --- 5. Write the now-verified match. Status goes straight to
  //        `searching` — see lib/types.ts / README for why
  //        `waiting_on_chain` doesn't fit this synchronous flow. ---
  const { data: insertedMatch, error: insertError } = await supabaseAdmin
    .from("matches")
    .insert({
      smart_contract_match_id: matchId,
      game_id: gameId,
      player_a_id: profile.id,
      stake_amount: entryFee.toString(), // BigInt -> base-10 string for NUMERIC(78,0)
      status: "searching",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ match: insertedMatch }, { status: 201 });
}
