import { NextRequest, NextResponse } from "next/server";
import { erc20Abi, getAddress, parseEventLogs } from "viem";
import { getCurrentProfile } from "@/lib/auth/server";
import { USDC_TOKEN_ADDRESS } from "@/lib/contracts";
import { escrowPublicClient } from "@/lib/serverEscrow";
import { getStudioFeeConfig } from "@/lib/studios";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordStudioAudit } from "@/lib/studioAudit";

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.wallet_address) return NextResponse.json({ error: "Link a wallet before paying the studio fee" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { studioId?: string; txHash?: `0x${string}` } | null;
  if (!body?.studioId || !body.txHash) return NextResponse.json({ error: "studioId and txHash are required" }, { status: 400 });
  const { data: studio, error: studioError } = await supabaseAdmin
    .from("studios").select("id,owner_user_id,status,listing_fee_amount").eq("id", body.studioId).maybeSingle();
  if (studioError) return NextResponse.json({ error: "Could not load studio" }, { status: 500 });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  if (studio.owner_user_id !== user.id) return NextResponse.json({ error: "Only the studio owner can pay the listing fee" }, { status: 403 });
  if (!['pending_payment', 'pending_review'].includes(studio.status)) return NextResponse.json({ error: "Studio is not awaiting a listing fee" }, { status: 409 });

  const { amount, treasury } = getStudioFeeConfig();
  if (BigInt(studio.listing_fee_amount) !== amount) return NextResponse.json({ error: "Stored listing fee does not match current fee configuration" }, { status: 409 });
  let receipt;
  try { receipt = await escrowPublicClient.getTransactionReceipt({ hash: body.txHash }); }
  catch { return NextResponse.json({ error: "Transaction is not confirmed yet" }, { status: 409 }); }
  if (receipt.status !== "success") return NextResponse.json({ error: "Studio fee transaction reverted" }, { status: 400 });
  if (!receipt.to || getAddress(receipt.to) !== getAddress(USDC_TOKEN_ADDRESS)) return NextResponse.json({ error: "Transaction does not target the configured USDC token" }, { status: 400 });
  if (getAddress(receipt.from) !== getAddress(user.wallet_address)) return NextResponse.json({ error: "Transaction sender does not match the authenticated wallet" }, { status: 403 });
  const transfers = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: "Transfer" });
  const validTransfer = transfers.some((log) =>
    getAddress(log.args.from) === getAddress(user.wallet_address as `0x${string}`) &&
    getAddress(log.args.to) === treasury && log.args.value === amount
  );
  if (!validTransfer) return NextResponse.json({ error: "The exact listing fee was not transferred to the configured treasury" }, { status: 400 });

  const payment = {
    studio_id: studio.id, payer_user_id: user.id, tx_hash: body.txHash.toLowerCase(),
    token_address: getAddress(USDC_TOKEN_ADDRESS), treasury_address: treasury,
    amount: amount.toString(), chain_id: (await escrowPublicClient.getChainId()).toString(), status: "confirmed",
  };
  const { error: paymentError } = await supabaseAdmin.from("studio_fee_payments").insert(payment);
  if (paymentError?.code === "23505") {
    const { data: existing } = await supabaseAdmin.from("studio_fee_payments").select("studio_id,payer_user_id,amount").eq("tx_hash", body.txHash.toLowerCase()).maybeSingle();
    if (!existing || existing.studio_id !== studio.id || existing.payer_user_id !== user.id || BigInt(existing.amount) !== amount) {
      return NextResponse.json({ error: "Transaction was already used for another studio fee" }, { status: 409 });
    }
  } else if (paymentError) {
    return NextResponse.json({ error: "Could not record studio fee" }, { status: 500 });
  }
  const { data: updated, error: updateError } = await supabaseAdmin.from("studios")
    .update({ status: "pending_review" }).eq("id", studio.id).in("status", ["pending_payment", "pending_review"]).select("*").single();
  if (updateError) return NextResponse.json({ error: "Fee confirmed but studio review state could not be updated" }, { status: 502 });
  await recordStudioAudit({ studioId: studio.id, actorUserId: user.id, eventType: "listing_fee_confirmed", idempotencyKey: `listing_fee_confirmed:${body.txHash.toLowerCase()}`, payload: { txHash: body.txHash.toLowerCase(), amount: amount.toString() } });
  return NextResponse.json({ studio: updated, payment: { txHash: body.txHash, amount: amount.toString() } });
}
