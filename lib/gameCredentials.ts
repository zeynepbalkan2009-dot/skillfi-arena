import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
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

const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

function readGameApiKeyPrefix(secret: string): string | null {
  const match = /^(sk_(?:test|live)_[0-9a-f]{12})_[a-zA-Z0-9_-]{40,}$/i.exec(secret);
  return match?.[1] ?? null;
}

export function hashGameApiKey(secret: string, prefix: string): string {
  return scryptSync(
    secret,
    `skillfi-game-api:${prefix.toLowerCase()}`,
    32,
    SCRYPT_OPTIONS,
  ).toString("hex");
}

export function createGameApiKey(environment: "test" | "live") {
  const prefix = `sk_${environment}_${randomBytes(6).toString("hex")}`;
  const token = randomBytes(32).toString("base64url");
  const secret = `${prefix}_${token}`;
  return { prefix, secret, secretHash: hashGameApiKey(secret, prefix) };
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
  return readGameApiKeyPrefix(secret) ? secret : null;
}

export async function authenticateGameApiKey(authorization: string | null, requiredScope: string) {
  const secret = readBearerSecret(authorization);
  if (!secret) return null;
  const prefix = readGameApiKeyPrefix(secret);
  if (!prefix) return null;

  const { data, error } = await supabaseAdmin
    .from("game_api_credentials")
    .select("id,game_id,studio_id,key_prefix,secret_hash,scopes,revoked_at,expires_at")
    .eq("key_prefix", prefix)
    .maybeSingle();
  if (error || !data || data.revoked_at || !data.scopes?.includes(requiredScope)) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;

  const expected = Buffer.from(String(data.secret_hash), "hex");
  const candidate = Buffer.from(hashGameApiKey(secret, prefix), "hex");
  if (expected.length !== candidate.length || !timingSafeEqual(expected, candidate)) return null;

  await supabaseAdmin
    .from("game_api_credentials")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  const { secret_hash: _secretHash, ...credential } = data;
  return credential as GameCredential;
}
