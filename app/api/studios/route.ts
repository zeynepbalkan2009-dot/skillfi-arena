import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { formatUsdcUnits } from "@/lib/env/public";
import { getStudioFeeConfig, normalizeStudioSlug, optionalUrl } from "@/lib/studios";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordStudioAudit } from "@/lib/studioAudit";
import { isStudioAdmin } from "@/lib/studioAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { amount, treasury } = getStudioFeeConfig();
  const { data: studio, error } = await supabaseAdmin.from("studios").select("*").eq("owner_user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load studio" }, { status: 500 });
  const { data: games, error: gamesError } = studio
    ? await supabaseAdmin.from("games").select("*").eq("studio_id", studio.id).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (gamesError) return NextResponse.json({ error: "Could not load studio games" }, { status: 500 });
  const { data: reviewEvents, error: reviewError } = studio
    ? await supabaseAdmin.from("studio_audit_events").select("game_id,event_type,payload,created_at").eq("studio_id", studio.id)
      .in("event_type", ["studio_rejected", "studio_suspended", "game_rejected", "game_suspended"]).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (reviewError) return NextResponse.json({ error: "Could not load review feedback" }, { status: 500 });
  const reviewEventRows = (reviewEvents ?? []) as Array<{ game_id: string | null; event_type: string; payload: unknown; created_at: string }>;
  const reviewFeedback = reviewEventRows.flatMap((event) => {
    const payload = event.payload as { note?: unknown } | null;
    return typeof payload?.note === "string" && payload.note.trim()
      ? [{ gameId: event.game_id, eventType: event.event_type, note: payload.note.trim(), createdAt: event.created_at }]
      : [];
  });
  return NextResponse.json({ studio, games: games ?? [], reviewFeedback, isAdmin: isStudioAdmin(user), fee: { amount: amount.toString(), displayAmount: formatUsdcUnits(amount), treasury } });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { name?: string; websiteUrl?: string; contactEmail?: string } | null;
  const name = body?.name?.trim() ?? "";
  const slug = normalizeStudioSlug(name);
  if (name.length < 2 || name.length > 80 || slug.length < 2 || slug.length > 80) {
    return NextResponse.json({ error: "Studio name must be between 2 and 80 characters" }, { status: 400 });
  }
  let websiteUrl: string | null;
  try { websiteUrl = optionalUrl(body?.websiteUrl); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid website" }, { status: 400 }); }
  const contactEmail = body?.contactEmail?.trim().toLowerCase() || user.email || null;
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json({ error: "Enter a valid contact email" }, { status: 400 });
  }
  const { amount } = getStudioFeeConfig();
  const { data, error } = await supabaseAdmin.from("studios").insert({
    owner_user_id: user.id, name, slug, website_url: websiteUrl, contact_email: contactEmail,
    status: "pending_payment", listing_fee_amount: amount.toString(), listing_fee_currency: "USDC",
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "A studio already exists for this account or name" : "Could not create studio" }, { status: 409 });
  await recordStudioAudit({ studioId: data.id, actorUserId: user.id, eventType: "studio_created", idempotencyKey: `studio_created:${data.id}`, payload: { name: data.name } });
  return NextResponse.json({ studio: data }, { status: 201 });
}
