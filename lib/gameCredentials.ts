import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type GameCredential = {
  id: string;
  game_id: string;
  studio_id: string;
  key_prefix: string;
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

export function verifyGameRequestSignature(secret: string, timestamp: string | null, rawBody: string, signature: string | null) {
  if (!timestamp || !signature || !/^\d{10,13}$/.test(timestamp) || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const timestampMs = timestamp.length === 10 ? Number(timestamp) * 1000 : Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest();
  const provided = Buffer.from(signature, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function readBearerSecret(authorization: string | null): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const secret = authorization.slice(7).trim();
  return /^sk_(test|live)_[a-zA-Z0-9_-]{20,}$/.test(secret) ? secret : null;
}

export async function authenticateGameApiKey(authorization: string | null, requiredScope: string) {
  const secret = readBearerSecret(authorization);
  if (!secret) return null;
  const { data, error } = await supabaseAdmin.from("game_api_credentials")
    .select("id,game_id,studio_id,key_prefix,scopes,revoked_at,expires_at").eq("secret_hash", hashGameApiKey(secret)).maybeSingle();
  if (error || !data || data.revoked_at || !data.scopes?.includes(requiredScope)) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;
  await supabaseAdmin.from("game_api_credentials").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data as GameCredential;
}
