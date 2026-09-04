import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type StakeReservation = {
  idempotency_key: string;
  user_id: string;
  match_id: string | null;
  amount: string;
  status: "reserved" | "confirmed" | "released";
};

export async function getStakeReservation(key: string): Promise<StakeReservation | null> {
  const { data, error } = await supabaseAdmin
    .from("risk_stake_reservations")
    .select("idempotency_key,user_id,match_id,amount,status")
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw new Error(`Risk reservation lookup failed: ${error.message}`);
  return (data as StakeReservation | null) ?? null;
}

export async function reserveStake(userId: string, amount: bigint, key: string) {
  const { data, error } = await supabaseAdmin
    .rpc("reserve_daily_stake", {
      p_user_id: userId,
      p_amount: amount.toString(),
      p_idempotency_key: key,
    })
    .single();
  if (error) throw new Error(`Risk check failed: ${error.message}`);
  return data as { allowed: boolean; reason: string; stake_used: string; loss_used: string };
}

export async function attachStakeReservation(key: string, matchId: string) {
  const { error } = await supabaseAdmin
    .from("risk_stake_reservations")
    .update({ match_id: matchId, updated_at: new Date().toISOString() })
    .eq("idempotency_key", key)
    .eq("status", "reserved")
    .is("match_id", null);
  if (error) throw new Error(`Risk reservation update failed: ${error.message}`);
}

export async function confirmStakeReservation(userId: string, matchId: string) {
  const { error } = await supabaseAdmin
    .from("risk_stake_reservations")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("match_id", matchId)
    .eq("status", "reserved");
  if (error) throw new Error(`Risk reservation confirmation failed: ${error.message}`);
}

export async function releaseStakeReservation(key: string) {
  const { error } = await supabaseAdmin
    .from("risk_stake_reservations")
    .update({ status: "released", updated_at: new Date().toISOString() })
    .eq("idempotency_key", key)
    .eq("status", "reserved");
  if (error) throw new Error(`Risk reservation release failed: ${error.message}`);
}

export async function releaseMatchStakeReservations(matchId: string) {
  const { error } = await supabaseAdmin
    .from("risk_stake_reservations")
    .update({ status: "released", updated_at: new Date().toISOString() })
    .eq("match_id", matchId)
    .in("status", ["reserved", "confirmed"]);
  if (error) throw new Error(`Match risk reservations could not be released: ${error.message}`);
}
