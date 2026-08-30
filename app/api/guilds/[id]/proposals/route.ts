import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { GuildProposalType } from "@/lib/types";

type ProposalRow = { id: string; [key: string]: unknown };
type VoteRow = { proposal_id: string; voter_user_id: string; choice: string };

async function membership(guildId: string, userId?: string) {
  if (!userId) return null;
  const { data } = await supabaseAdmin.from("guild_members").select("role").eq("guild_id", guildId).eq("user_id", userId).maybeSingle();
  return data;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  const { data, error } = await supabaseAdmin.from("guild_proposals").select("*").eq("guild_id", params.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load proposals" }, { status: 500 });
  const proposalRows = (data ?? []) as ProposalRow[];
  const ids = proposalRows.map((proposal) => proposal.id);
  const { data: voteData } = ids.length ? await supabaseAdmin.from("guild_votes").select("proposal_id,voter_user_id,choice").in("proposal_id", ids) : { data: [] };
  const votes = (voteData ?? []) as VoteRow[];
  const proposals = proposalRows.map((proposal) => ({ ...proposal, votes_for: votes.filter((vote) => vote.proposal_id === proposal.id && vote.choice === "for").length, votes_against: votes.filter((vote) => vote.proposal_id === proposal.id && vote.choice === "against").length, votes_abstain: votes.filter((vote) => vote.proposal_id === proposal.id && vote.choice === "abstain").length, current_user_vote: votes.find((vote) => vote.proposal_id === proposal.id && vote.voter_user_id === user?.id)?.choice ?? null }));
  return NextResponse.json({ proposals, member: Boolean(await membership(params.id, user?.id)) });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await membership(params.id, user.id))) return NextResponse.json({ error: "Guild membership required" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { title?: string; description?: string; proposalType?: GuildProposalType; amount?: string } | null;
  const title = body?.title?.trim() ?? ""; const description = body?.description?.trim() ?? ""; const type = body?.proposalType ?? "strategy";
  if (title.length < 5 || title.length > 100 || description.length < 10 || description.length > 1000 || !["strategy","treasury","membership"].includes(type)) return NextResponse.json({ error: "Enter a valid proposal title and description" }, { status: 400 });
  const amount = body?.amount?.trim() || null;
  if (type === "treasury" && (!amount || !/^\d+$/.test(amount) || BigInt(amount) <= 0n)) return NextResponse.json({ error: "Treasury proposals require a positive raw USDC amount" }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("guild_proposals").insert({ guild_id: params.id, proposer_user_id: user.id, title, description, proposal_type: type, amount: type === "treasury" ? amount : null, closes_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() }).select("*").single();
  if (error) return NextResponse.json({ error: "Could not create proposal" }, { status: 500 });
  return NextResponse.json({ proposal: data }, { status: 201 });
}
