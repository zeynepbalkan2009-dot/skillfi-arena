import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type GameCredential = {
  id: string;
  game_id: string;
  studio_id: string;
  scopes: string[];
  revoked_at: string | null;
  expires_at: string | null;
};

export function hashGameApiKey(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function createGameApiKey(environment: "test" | "live") {
  const token = randomBytes(32).toString("base64url");
  const prefix = `sk_${environment}_${token.slice(0, 8)}`;
  const secret = `${prefix}_${token}`;
  return { prefix, secret, secretHash: hashGameApiKey(secret) };
}

export async function authenticateGameApiKey(authorization: string | null, requiredScope: string) {
  if (!authorization?.startsWith("Bearer ")) return null;
  const secret = authorization.slice(7).trim();
  if (!/^sk_(test|live)_[a-zA-Z0-9_-]{20,}$/.test(secret)) return null;
  const { data, error } = await supabaseAdmin.from("game_api_credentials")
    .select("id,game_id,studio_id,scopes,revoked_at,expires_at").eq("secret_hash", hashGameApiKey(secret)).maybeSingle();
  if (error || !data || data.revoked_at || !data.scopes?.includes(requiredScope)) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;
  await supabaseAdmin.from("game_api_credentials").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data as GameCredential;
}

