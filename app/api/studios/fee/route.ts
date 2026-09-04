import { NextRequest, NextResponse } from "next/server";
import { erc20Abi, getAddress, parseEventLogs } from "viem";
import { getCurrentProfile } from "@/lib/auth/server";
import { USDC_TOKEN_ADDRESS } from "@/lib/contracts";
import { escrowPublicClient } from "@/lib/serverEscrow";
import { getStudioFeeConfig } from "@/lib/studios";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordStudioAudit } from "@/lib/studioAudit";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE });
  if (!user.wallet_address) return NextResponse.json({ error: "Link a wallet before paying the studio fee" }, { status: 400, headers: PRIVATE_NO_STORE });
  const body = (await request.json().catch(() => null)) as { studioId?: string; txHash?: `0x${string}` } | null;
  if (!body?.studioId || !body.txHash) return NextResponse.json({ error: "studioId and txHash are required" }, { status: 400, headers: PRIVATE_NO_STORE });
  const { data: studio, error: studioError } = await supabaseAdmin
    .from("studios").select("id,owner_user_id,status,listing_fee_amount,created_at").eq("id", body.studioId).maybeSingle();
  if (studioError) {
    console.error("Studio fee lookup failed:", studioError.message);
    return NextResponse.json({ error: "Could not load studio" }, { status: 500, headers: PRIVATE_NO_STORE });
  }
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404, headers: PRIVATE_NO_STORE });
  if (studio.owner_user_id !== user.id) return NextResponse.json({ error: "Only the studio owner can pay the listing fee" }, { status: 403, headers: PRIVATE_NO_STORE });
  if (!['pending_payment', 'pending_review'].includes(studio.status)) return NextResponse.json({ error: "Studio is not awaiting a listing fee" }, { status: 409, headers: PRIVATE_NO_STORE });

  let feeConfig: ReturnType<typeof getStudioFeeConfig>;
  try {
    feeConfig = getStudioFeeConfig();
  } catch (error) {
    console.error("Studio fee configuration error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Studio fee configuration is unavailable" }, { status: 503, headers: PRIVATE_NO_STORE });
  }
  const { amount, treasury } = feeConfig;
  if (BigInt(studio.listing_fee_amount) !== amount) return NextResponse.json({ error: "Stored listing fee does not match current fee configuration" }, { status: 409, headers: PRIVATE_NO_STORE });

  let receipt;
  try { receipt = await escrowPublicClient.getTransactionReceipt({ hash: body.txHash }); }
  catch { return NextResponse.json({ error: "Transaction is not confirmed yet" }, { status: 409, headers: PRIVATE_NO_STORE }); }
  if (receipt.status !== "success") return NextResponse.json({ error: "Studio fee transaction reverted" }, { status: 400, headers: PRIVATE_NO_STORE });
  if (!receipt.to || getAddress(receipt.to) !== getAddress(USDC_TOKEN_ADDRESS)) return NextResponse.json({ error: "Transaction does not target the configured USDC token" }, { status: 400, headers: PRIVATE_NO_STORE });
  if (getAddress(receipt.from) !== getAddress(user.wallet_address)) return NextResponse.json({ error: "Transaction sender does not match the authenticated wallet" }, { status: 403, headers: PRIVATE_NO_STORE });

  const createdAtMs = Date.parse(studio.created_at);
  if (!Number.isFinite(createdAtMs)) {
    console.error("Studio has invalid created_at:", studio.id);
    return NextResponse.json({ error: "Studio fee verification is unavailable" }, { status: 500, headers: PRIVATE_NO_STORE });
  }
  const paymentBlock = await escrowPublicClient.getBlock({ blockNumber: receipt.blockNumber });
  const studioCreatedAtSeconds = BigInt(Math.floor(createdAtMs / 1000));
  if (paymentBlock.timestamp + 120n < studioCreatedAtSeconds) {
    return NextResponse.json({ error: "Transaction predates this studio fee request" }, { status: 409, headers: PRIVATE_NO_STORE });
  }

  const transfers = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: "Transfer" });
  const validTransfer = transfers.some((log) =>
    getAddress(log.address) === getAddress(USDC_TOKEN_ADDRESS) &&
    getAddress(log.args.from) === getAddress(user.wallet_address as `0x${string}`) &&
    getAddress(log.args.to) === treasury &&
    log.args.value === amount
  );
  if (!validTransfer) return NextResponse.json({ error: "The exact listing fee was not transferred to the configured treasury" }, { status: 400, headers: PRIVATE_NO_STORE });

  const payment = {
    studio_id: studio.id, payer_user_id: user.id, tx_hash: body.txHash.toLowerCase(),
    token_address: getAddress(USDC_TOKEN_ADDRESS), treasury_address: treasury,
    amount: amount.toString(), chain_id: (await escrowPublicClient.getChainId()).toString(), status: "confirmed",
  };
  const { error: paymentError } = await supabaseAdmin.from("studio_fee_payments").insert(payment);
  if (paymentError?.code === "23505") {
    const { data: existing } = await supabaseAdmin.from("studio_fee_payments").select("studio_id,payer_user_id,amount").eq("tx_hash", body.txHash.toLowerCase()).maybeSingle();
    if (!existing || existing.studio_id !== studio.id || existing.payer_user_id !== user.id || BigInt(existing.amount) !== amount) {
      return NextResponse.json({ error: "Transaction was already used for another studio fee" }, { status: 409, headers: PRIVATE_NO_STORE });
    }
  } else if (paymentError) {
    console.error("Studio fee payment insert failed:", paymentError.message);
    return NextResponse.json({ error: "Could not record studio fee" }, { status: 500, headers: PRIVATE_NO_STORE });
  }
  const { data: updated, error: updateError } = await supabaseAdmin.from("studios")
    .update({ status: "pending_review" }).eq("id", studio.id).in("status", ["pending_payment", "pending_review"]).select("*").single();
  if (updateError) {
    console.error("Studio fee review state update failed:", updateError.message);
    return NextResponse.json({ error: "Fee confirmed but studio review state could not be updated" }, { status: 502, headers: PRIVATE_NO_STORE });
  }
  await recordStudioAudit({ studioId: studio.id, actorUserId: user.id, eventType: "listing_fee_confirmed", idempotencyKey: `listing_fee_confirmed:${body.txHash.toLowerCase()}`, payload: { txHash: body.txHash.toLowerCase(), amount: amount.toString() } });
  return NextResponse.json({ studio: updated, payment: { txHash: body.txHash, amount: amount.toString() } }, { headers: PRIVATE_NO_STORE });
}
