import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function hasActiveBetaAccess(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from("beta_pilot_enrollments")
    .select("id").eq("user_id", userId).eq("status", "active").maybeSingle();
  if (error) throw new Error("Could not verify beta pilot access");
  return Boolean(data);
}

export const BETA_ACCESS_ERROR = "Active controlled-beta access is required for pilot games";
