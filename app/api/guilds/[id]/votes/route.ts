import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { GuildVoteChoice } from "@/lib/types";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { proposalId?: string; choice?: GuildVoteChoice } | null;
  if (!body?.proposalId || !body.choice || !["for","against","abstain"].includes(body.choice)) return NextResponse.json({ error: "Valid proposalId and choice are required" }, { status: 400 });
  const [{ data: member }, { data: proposal }] = await Promise.all([supabaseAdmin.from("guild_members").select("user_id").eq("guild_id", params.id).eq("user_id", user.id).maybeSingle(), supabaseAdmin.from("guild_proposals").select("id,status,closes_at").eq("id", body.proposalId).eq("guild_id", params.id).maybeSingle()]);
  if (!member) return NextResponse.json({ error: "Guild membership required" }, { status: 403 });
  if (!proposal || proposal.status !== "active" || new Date(proposal.closes_at).getTime() <= Date.now()) return NextResponse.json({ error: "Proposal is not open" }, { status: 409 });
  const { error } = await supabaseAdmin.from("guild_votes").upsert({ proposal_id: proposal.id, voter_user_id: user.id, choice: body.choice }, { onConflict: "proposal_id,voter_user_id" });
  if (error) return NextResponse.json({ error: "Could not record vote" }, { status: 500 });
  return NextResponse.json({ voted: true });
}
