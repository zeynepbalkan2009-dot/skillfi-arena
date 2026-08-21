import { NextRequest, NextResponse } from "next/server";
import { privy, verifyPrivyAccessToken } from "@/lib/privy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { UserRegion } from "@/lib/types";

interface SyncBody {
  username?: string;
  region?: UserRegion;
}

export async function POST(request: NextRequest) {
  const privyUserId = await verifyPrivyAccessToken(request.headers.get("authorization"));
  if (!privyUserId) {
    return NextResponse.json({ error: "Invalid or missing Privy access token" }, { status: 401 });
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("users")
    .select("id, username, region, wallet_address")
    .eq("privy_user_id", privyUserId)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (existing) return NextResponse.json({ user: existing });

  let body: SyncBody = {};
  try { body = await request.json(); } catch {}
  if (!body.username || !body.region) {
    return NextResponse.json({ error: "username and region are required" }, { status: 400 });
  }

  const privyUser = await privy.users()._get(privyUserId);
  const linkedWallet = privyUser.linked_accounts.find(
    (account): account is Extract<typeof account, { type: "wallet"; chain_type: "ethereum" }> =>
      account.type === "wallet" && account.chain_type === "ethereum"
  );

  const { data: created, error: insertError } = await supabaseAdmin
    .from("users")
    .insert({
      privy_user_id: privyUserId,
      username: body.username,
      region: body.region,
      wallet_address: linkedWallet?.address ?? null,
    })
    .select("id, username, region, wallet_address")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 409 });
  return NextResponse.json({ user: created }, { status: 201 });
}
