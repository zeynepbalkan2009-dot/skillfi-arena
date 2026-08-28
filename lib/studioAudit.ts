import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function recordStudioAudit(event: {
  studioId: string;
  gameId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("studio_audit_events").insert({
    studio_id: event.studioId, game_id: event.gameId ?? null, actor_user_id: event.actorUserId ?? null,
    event_type: event.eventType, idempotency_key: event.idempotencyKey, payload: event.payload ?? {},
  });
  if (error && error.code !== "23505") throw new Error(`Studio audit write failed: ${error.message}`);
}

