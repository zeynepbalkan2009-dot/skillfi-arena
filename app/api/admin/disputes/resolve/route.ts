import { NextRequest, NextResponse } from "next/server";
import { getAddress, keccak256, parseAbi, parseAbiItem, stringToBytes, type Address } from "viem";
import { getCurrentProfile } from "@/lib/auth/server";
import { recordAuditEvent } from "@/lib/audit";
import { isStudioAdmin } from "@/lib/studioAdmin";
import { ESCROW_CONTRACT_ADDRESS, escrowPublicClient, getEscrowWalletClient, getOperatorAddress } from "@/lib/serverEscrow";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const abi = parseAbi([
  "function matches(uint256) view returns(address player1,address player2,uint256 entryFee,uint256 createdAt,bool player1Deposited,bool player2Deposited,uint8 status)",
  "function platformFeeBps() view returns(uint256)",
  "function hasRole(bytes32,address) view returns(bool)",
  "function resolveDispute(uint256 matchId,address winner)",
]);
const resolvedEvent = parseAbiItem("event MatchResolved(uint256 indexed matchId,address indexed winner,uint256 prize)");
const arbiterRole = keccak256(stringToBytes("ARBITER_ROLE"));
type WalletRow = { id: string; wallet_address: string | null };

async function findResolution(matchId: bigint) {
  const latestBlock = await escrowPublicClient.getBlockNumber();
  for (let offset = 0n; offset < 500_000n; offset += 9_999n) {
    const toBlock = latestBlock > offset ? latestBlock - offset : 0n;
    const fromBlock = toBlock > 9_998n ? toBlock - 9_998n : 0n;
    const logs = await escrowPublicClient.getLogs({ address: ESCROW_CONTRACT_ADDRESS, event: resolvedEvent, args: { matchId }, fromBlock, toBlock });
    if (logs.length) return logs.at(-1) ?? null;
    if (fromBlock === 0n) break;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const admin = await getCurrentProfile(request.headers.get("authorization"));
  if (!admin || !isStudioAdmin(admin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { matchId?: string; winnerId?: string; confirmation?: string } | null;
  if (!body?.matchId || !body.winnerId || body.confirmation !== "RESOLVE_DISPUTE") {
    return NextResponse.json({ error: "Match, winner, and explicit confirmation are required" }, { status: 400 });
  }

  const { data: match, error: matchError } = await supabaseAdmin.from("matches")
    .select("id,smart_contract_match_id,player_a_id,player_b_id,status")
    .eq("id", body.matchId).maybeSingle();
  if (matchError || !match) return NextResponse.json({ error: "Disputed match not found" }, { status: 404 });
  if (match.status !== "disputed") return NextResponse.json({ error: "Match is not pending arbitration" }, { status: 409 });
  if (![match.player_a_id, match.player_b_id].includes(body.winnerId)) return NextResponse.json({ error: "Winner must be a match participant" }, { status: 400 });

  const { data: players, error: playersError } = await supabaseAdmin.from("users").select("id,wallet_address").in("id", [match.player_a_id, match.player_b_id]);
  const walletRows = (players ?? []) as WalletRow[];
  if (playersError || walletRows.length !== 2 || walletRows.some((player) => !player.wallet_address)) {
    return NextResponse.json({ error: "Both participants need verified wallets" }, { status: 409 });
  }
  const wallets = new Map(walletRows.map((player) => [player.id, getAddress(player.wallet_address!)]));
  const playerAWallet = wallets.get(match.player_a_id)!;
  const playerBWallet = wallets.get(match.player_b_id)!;
  const winnerWallet = wallets.get(body.winnerId)!;
  const chainMatchId = BigInt(match.smart_contract_match_id);

  const signer = getOperatorAddress();
  const [onchain, hasArbiterRole, feeBps] = await Promise.all([
    escrowPublicClient.readContract({ address: ESCROW_CONTRACT_ADDRESS, abi, functionName: "matches", args: [chainMatchId] }),
    escrowPublicClient.readContract({ address: ESCROW_CONTRACT_ADDRESS, abi, functionName: "hasRole", args: [arbiterRole, signer] }),
    escrowPublicClient.readContract({ address: ESCROW_CONTRACT_ADDRESS, abi, functionName: "platformFeeBps" }),
  ]);
  if (!hasArbiterRole) return NextResponse.json({ error: "Server signer is not an arbiter" }, { status: 503 });
  const chainMatch = onchain as readonly [Address, Address, bigint, bigint, boolean, boolean, number];
  if (![4, 5].includes(Number(chainMatch[6]))) return NextResponse.json({ error: "On-chain match is not disputed or resolved" }, { status: 409 });
  const chainPlayers = [getAddress(chainMatch[0]), getAddress(chainMatch[1])];
  if (!chainPlayers.includes(playerAWallet) || !chainPlayers.includes(playerBWallet) || !chainPlayers.includes(winnerWallet)) {
    return NextResponse.json({ error: "Database and on-chain participants do not match" }, { status: 409 });
  }

  const payout = chainMatch[2] * 2n - (chainMatch[2] * 2n * feeBps) / 10_000n;
  let hash: `0x${string}`;
  let recovered = false;
  if (Number(chainMatch[6]) === 5) {
    hash = await getEscrowWalletClient().writeContract({ address: ESCROW_CONTRACT_ADDRESS, abi, functionName: "resolveDispute", args: [chainMatchId, winnerWallet] });
    await supabaseAdmin.from("transactions").upsert({ user_id: body.winnerId, match_id: match.id, tx_hash: hash.toLowerCase(), kind: "settlement", amount: payout.toString(), status: "pending" }, { onConflict: "tx_hash,kind,user_id" }).throwOnError();
    await recordAuditEvent({ matchId: match.id, actorUserId: admin.id, eventType: "dispute_resolution_broadcast", txHash: hash, idempotencyKey: `dispute_resolution_broadcast:${match.id}`, payload: { winnerId: body.winnerId, payout: payout.toString() } });
    const receipt = await escrowPublicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") return NextResponse.json({ error: "Dispute resolution reverted" }, { status: 502 });
  } else {
    const event = await findResolution(chainMatchId);
    if (!event?.transactionHash || !event.args.winner || getAddress(event.args.winner) !== winnerWallet || event.args.prize !== payout) {
      return NextResponse.json({ error: "Existing on-chain resolution does not match the requested winner" }, { status: 409 });
    }
    hash = event.transactionHash;
    recovered = true;
  }

  await supabaseAdmin.from("transactions").upsert({ user_id: body.winnerId, match_id: match.id, tx_hash: hash.toLowerCase(), kind: "settlement", amount: payout.toString(), status: "confirmed" }, { onConflict: "tx_hash,kind,user_id" }).throwOnError();
  const { data: completed, error: completionError } = await supabaseAdmin.from("matches").update({ status: "completed", winner_id: body.winnerId })
    .eq("id", match.id).eq("status", "disputed").select("id").maybeSingle();
  if (completionError || !completed) return NextResponse.json({ error: "Resolution confirmed but database reconciliation needs attention", txHash: hash }, { status: 503 });
  await recordAuditEvent({ matchId: match.id, actorUserId: admin.id, eventType: "dispute_resolved", txHash: hash, idempotencyKey: `dispute_resolved:${match.id}`, payload: { winnerId: body.winnerId, payout: payout.toString(), recovered } });
  return NextResponse.json({ status: "completed", winnerId: body.winnerId, txHash: hash, recovered });
}
