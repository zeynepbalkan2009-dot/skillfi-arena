import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
const TERMS_VERSION = "2026-08-31";
const PRIVACY_VERSION = "2026-08-31";

export async function GET(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ enrollment: null, capacity: { active: 0, limit: 100 } });
  const [{ data, error }, { count }] = await Promise.all([
    supabaseAdmin.from("beta_pilot_enrollments").select("*").eq("user_id", user.id).maybeSingle(),
    supabaseAdmin.from("beta_pilot_enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  if (error) {
    const setupRequired = error.code === "42P01" || error.code === "PGRST205";
    return NextResponse.json({ error: setupRequired ? "Pilot enrollment migration is pending" : "Could not load enrollment", setupRequired }, { status: 503 });
  }
  return NextResponse.json({ enrollment: data, capacity: { active: count ?? 0, limit: 100 } });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Complete login and player profile first" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { adultAttested?: boolean; termsAccepted?: boolean; privacyAccepted?: boolean } | null;
  if (!body?.adultAttested || !body.termsAccepted || !body.privacyAccepted) {
    return NextResponse.json({ error: "Adult eligibility, pilot terms, and privacy notice must all be accepted" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from("beta_pilot_enrollments").insert({
    user_id: user.id,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    adult_attested_at: now,
    consented_at: now,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "A pilot application already exists for this player" : "Could not create pilot application" }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ enrollment: data }, { status: 201 });
}
