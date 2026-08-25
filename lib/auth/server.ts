import "server-only";
import { getPrivyClient, verifyPrivyAccessToken } from "@/lib/privy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PlayerProfile, UserRegion } from "@/lib/types";

export type PrivyIdentity = {
  privyUserId: string;
  email: string | null;
  primaryWallet: string | null;
};

function normalizeWallet(value: string | null | undefined): string | null {
  return value ? value.toLowerCase() : null;
}

export async function getPrivyIdentityFromRequest(authHeader: string | null): Promise<PrivyIdentity | null> {
  const privyUserId = await verifyPrivyAccessToken(authHeader);
  if (!privyUserId) return null;

  if (process.env.SKILLFI_TEST_PRIVY_USERS) {
    try {
      const users = JSON.parse(process.env.SKILLFI_TEST_PRIVY_USERS) as Record<
        string,
        { email?: string | null; primaryWallet?: string | null }
      >;
      const user = users[privyUserId];
      if (!user) return null;
      return {
        privyUserId,
        email: user.email ?? null,
        primaryWallet: normalizeWallet(user.primaryWallet),
      };
    } catch {
      return null;
    }
  }

  const privyUser = (await getPrivyClient().users()._get(privyUserId)) as any;
  const linkedAccounts: any[] = Array.isArray(privyUser.linked_accounts) ? privyUser.linked_accounts : [];
  const wallet = linkedAccounts.find(
    (account) => account?.type === "wallet" && (!("chain_type" in account) || account.chain_type === "ethereum")
  );
  const emailAccount = linkedAccounts.find(
    (account) => account?.type === "email"
  );
  const email = "email" in privyUser && typeof privyUser.email?.address === "string"
    ? privyUser.email.address
    : emailAccount?.address ?? emailAccount?.email ?? null;

  return {
    privyUserId,
    email,
    primaryWallet: normalizeWallet(wallet?.address),
  };
}

export async function getCurrentProfile(authHeader: string | null): Promise<PlayerProfile | null> {
  const identity = await getPrivyIdentityFromRequest(authHeader);
  if (!identity) return null;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, privy_user_id, username, display_name, avatar_url, region, email, wallet_address, primary_wallet_address, wins, losses, matches_played, elo_rating, total_earnings, created_at, last_login_at"
    )
    .eq("privy_user_id", identity.privyUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PlayerProfile | null) ?? null;
}

export async function syncProfile(
  identity: PrivyIdentity,
  body: { username?: string; region?: UserRegion; displayName?: string; avatarUrl?: string }
): Promise<PlayerProfile> {
  const existing = await getCurrentProfileForIdentity(identity);
  const wallet = identity.primaryWallet;
  const updateBase = {
    email: identity.email,
    wallet_address: wallet,
    primary_wallet_address: wallet,
    last_login_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .update(updateBase)
      .eq("id", existing.id)
      .select(
        "id, privy_user_id, username, display_name, avatar_url, region, email, wallet_address, primary_wallet_address, wins, losses, matches_played, elo_rating, total_earnings, created_at, last_login_at"
      )
      .single();
    if (error) throw new Error(error.message);
    return data as PlayerProfile;
  }

  if (!body.username || !body.region) {
    throw new MissingProfileFieldsError();
  }

  const username = body.username.trim();
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    throw new Error("Username must be 3-24 characters and use only letters, numbers, and underscores.");
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      privy_user_id: identity.privyUserId,
      username,
      display_name: body.displayName?.trim() || username,
      avatar_url: body.avatarUrl?.trim() || null,
      region: body.region,
      ...updateBase,
    })
    .select(
      "id, privy_user_id, username, display_name, avatar_url, region, email, wallet_address, primary_wallet_address, wins, losses, matches_played, elo_rating, total_earnings, created_at, last_login_at"
    )
    .single();

  if (error) throw new Error(error.message);

  await supabaseAdmin.from("user_risk_profiles").insert({ user_id: data.id }).throwOnError();
  return data as PlayerProfile;
}

async function getCurrentProfileForIdentity(identity: PrivyIdentity): Promise<PlayerProfile | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, privy_user_id, username, display_name, avatar_url, region, email, wallet_address, primary_wallet_address, wins, losses, matches_played, elo_rating, total_earnings, created_at, last_login_at"
    )
    .eq("privy_user_id", identity.privyUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PlayerProfile | null) ?? null;
}

export class MissingProfileFieldsError extends Error {
  constructor() {
    super("username and region are required to create a new account");
  }
}
