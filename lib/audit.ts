import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AuditEvent = {
  matchId?: string | null;
  challengeId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  txHash?: string | null;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
};

export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  const { error } = await supabaseAdmin.from("match_audit_events").insert({
    match_id: event.matchId ?? null,
    challenge_id: event.challengeId ?? null,
    actor_user_id: event.actorUserId ?? null,
    event_type: event.eventType,
    tx_hash: event.txHash?.toLowerCase() ?? null,
    idempotency_key: event.idempotencyKey,
    payload: event.payload ?? {},
  });

  // A repeated request with the same event key is already safely recorded.
  if (error && error.code !== "23505") throw new Error(`Audit write failed: ${error.message}`);
}
