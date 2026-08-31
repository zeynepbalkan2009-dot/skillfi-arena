import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { isStudioAdmin } from "@/lib/studioAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function admin(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  return user && isStudioAdmin(user) ? user : null;
}

export async function GET(request: NextRequest) {
  if (!(await admin(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabaseAdmin.from("beta_pilot_enrollments")
    .select("*,user:users(id,username,display_name,region,wallet_address)").order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Could not load pilot cohort" }, { status: 500 });
  const rows = data ?? [];
  const counts = Object.fromEntries(["applied","active","completed","withdrawn","rejected"].map((status) => [status, rows.filter((row: { status: string }) => row.status === status).length]));
  return NextResponse.json({ enrollments: rows, counts, limit: 100 });
}

export async function PATCH(request: NextRequest) {
  const user = await admin(request);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { enrollmentId?: string; decision?: string; note?: string } | null;
  const note = body?.note?.trim() ?? "";
  if (!body?.enrollmentId || !["active","rejected","completed"].includes(body.decision ?? "") || note.length > 500) {
    return NextResponse.json({ error: "Valid enrollment, decision, and note are required" }, { status: 400 });
  }
  if (body.decision === "active") {
    const { data, error } = await supabaseAdmin.rpc("activate_beta_participant", { p_enrollment_id: body.enrollmentId, p_admin_user_id: user.id, p_review_note: note });
    if (error) return NextResponse.json({ error: /capacity reached/i.test(error.message) ? "The 100-player pilot is full" : "Enrollment cannot be activated" }, { status: 409 });
    return NextResponse.json({ enrollment: data });
  }
  const patch = body.decision === "completed" ? { status: "completed", completed_at: new Date().toISOString() } : { status: "rejected" };
  const { data, error } = await supabaseAdmin.from("beta_pilot_enrollments").update({ ...patch, reviewed_by_user_id: user.id, review_note: note })
    .eq("id", body.enrollmentId).in("status", body.decision === "completed" ? ["active"] : ["applied"]).select("*").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Enrollment transition was rejected" }, { status: 409 });
  return NextResponse.json({ enrollment: data });
}
