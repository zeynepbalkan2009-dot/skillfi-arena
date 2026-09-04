import { notFound } from "next/navigation";
import { ChallengeInviteClient } from "@/components/ChallengeInviteClient";
import { hashInvitationToken } from "@/lib/challenges/tokens";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ChallengeWithRelations } from "@/lib/types";

export const dynamic = "force-dynamic";

const INVITE_SELECT = `
  id,
  creator_id,
  entry_fee,
  opponent_mode,
  rules,
  status,
  expires_at,
  accepted_at,
  game:games(
    id,
    slug,
    name,
    type,
    description,
    website_url,
    is_active
  ),
  creator:users!challenges_creator_id_fkey(
    id,
    username,
    display_name,
    avatar_url,
    region
  ),
  accepted_by:users!challenges_accepted_by_id_fkey(
    id,
    username,
    display_name,
    avatar_url,
    region
  ),
  match:matches(
    id,
    smart_contract_match_id,
    game_id,
    player_a_id,
    player_b_id,
    stake_amount,
    status,
    created_at,
    player_a:users!matches_player_a_id_fkey(
      id,
      username,
      display_name,
      avatar_url,
      region
    ),
    player_b:users!matches_player_b_id_fkey(
      id,
      username,
      display_name,
      avatar_url,
      region
    )
  )
`;

export default async function ChallengePage({ params }: { params: { token: string } }) {
  const { data, error } = await supabaseAdmin
    .from("challenges")
    .select(INVITE_SELECT)
    .eq("invitation_token_hash", hashInvitationToken(params.token))
    .maybeSingle();

  if (error || !data) notFound();
  return (
    <ChallengeInviteClient
      challenge={data as unknown as ChallengeWithRelations}
      invitationToken={params.token}
    />
  );
}
