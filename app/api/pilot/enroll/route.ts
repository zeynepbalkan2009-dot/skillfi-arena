import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PILOT_PRIVACY_VERSION, PILOT_TERMS_VERSION } from "@/lib/pilotPolicy";

export const dynamic = "force-dynamic";

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
    terms_version: PILOT_TERMS_VERSION,
    privacy_version: PILOT_PRIVACY_VERSION,
    adult_attested_at: now,
    consented_at: now,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "A pilot application already exists for this player" : "Could not create pilot application" }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ enrollment: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Sign in before changing pilot participation" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "withdraw") return NextResponse.json({ error: "Unsupported pilot action" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("beta_pilot_enrollments")
    .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .in("status", ["applied", "active"])
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not withdraw pilot participation" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Only an applied or active enrollment can be withdrawn" }, { status: 409 });
  return NextResponse.json({ enrollment: data });
}
