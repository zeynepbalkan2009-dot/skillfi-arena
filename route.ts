import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyAccessToken, privy } from "@/lib/privy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { UserRegion } from "@/lib/types";

/**
 * Replaces the old `auth.users` insert trigger (handle_new_user) from the
 * pre-Privy schema. There is no guarantee a Privy-authenticated user has a
 * corresponding `auth.users` row anymore — see
 * supabase/migrations/02_privy_identity_migration.sql — so account
 * provisioning is now explicit: the frontend calls this route once after
 * a successful Privy login (see components/AuthSync.tsx), and this route
 * finds-or-creates the matching `public.users` row.
 *
 * Call this idempotently — it's safe to call on every login, not just the
 * first one. Existing users get their row back unchanged; only a
 * never-seen-before privy_user_id triggers an insert.
 */

interface SyncRequestBody {
  // Only used the first time this Privy user is seen — ignored on
  // subsequent calls, since an existing row already has these set.
  username?: string;
  region?: UserRegion;
}

export async function POST(request: NextRequest) {
  const privyUserId = await verifyPrivyAccessToken(request.headers.get("authorization"));
  if (!privyUserId) {
    return NextResponse.json({ error: "Invalid or missing Privy access token" }, { status: 401 });
  }

  // --- Already provisioned? Return the existing row as-is. ---
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("users")
    .select("id, username, region, wallet_address")
    .eq("privy_user_id", privyUserId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ user: existing }, { status: 200 });
  }

  // --- First time seeing this Privy user: gather what we need to create
  //     the row. The wallet address is pulled from Privy's own record of
  //     this user's linked accounts (server-to-server), not trusted from
  //     the request body — a client could otherwise claim any wallet as
  //     its own. ---
  let body: SyncRequestBody = {};
  try {
    body = await request.json();
  } catch {
    // No body / non-JSON body is fine — username/region just won't be set
    // on first creation, and the insert below will fail its NOT NULL
    // constraints with a clear error rather than silently defaulting.
  }

  const privyUser = await privy.users()._get(privyUserId);
  const linkedWallet = privyUser.linked_accounts.find(
    (account): account is Extract<typeof account, { type: "wallet"; chain_type: "ethereum" }> =>
      account.type === "wallet" && account.chain_type === "ethereum"
  );

  if (!body.username || !body.region) {
    return NextResponse.json(
      { error: "username and region are required to create a new account" },
      { status: 400 }
    );
  }

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

  if (insertError) {
    // Most likely cause: username already taken (unique constraint).
    return NextResponse.json({ error: insertError.message }, { status: 409 });
  }

  // New users start with the schema's default risk profile (1000 GNESS
  // daily loss limit) — see supabase/02_skillfi_schema.sql.
  const { error: riskProfileError } = await supabaseAdmin
    .from("user_risk_profiles")
    .insert({ user_id: created.id });

  if (riskProfileError) {
    // The user row exists but its risk profile didn't get created — log
    // loudly rather than silently leaving a player without loss-limit
    // tracking. A retry of this same route is safe (the users insert
    // above won't re-run since privy_user_id now matches `existing`,
    // but the risk profile insert needs its own idempotent retry path
    // in a production hardening pass).
    console.error(`Failed to create risk profile for user ${created.id}:`, riskProfileError.message);
  }

  return NextResponse.json({ user: created }, { status: 201 });
}
