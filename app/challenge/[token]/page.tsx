import { notFound } from "next/navigation";
import { ChallengeInviteClient } from "@/components/ChallengeInviteClient";
import { hashInvitationToken } from "@/lib/challenges/tokens";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ChallengeWithRelations } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ChallengePage({ params }: { params: { token: string } }) {
  const { data, error } = await supabaseAdmin
    .from("challenges")
    .select(
      "id, game_id, creator_id, invited_opponent_id, accepted_by_id, match_id, entry_fee, currency, opponent_mode, rules, status, expires_at, accepted_at, created_at, updated_at, game:games(*), creator:users!challenges_creator_id_fkey(id,username,display_name,avatar_url,region,wallet_address), accepted_by:users!challenges_accepted_by_id_fkey(id,username,display_name,avatar_url,region,wallet_address), match:matches(id,challenge_id,smart_contract_match_id,game_id,player_a_id,player_b_id,stake_amount,status,winner_id,created_at,updated_at,game:games(*),player_a:users!matches_player_a_id_fkey(id,username,display_name,avatar_url,region,wallet_address),player_b:users!matches_player_b_id_fkey(id,username,display_name,avatar_url,region,wallet_address))"
    )
    .eq("invitation_token_hash", hashInvitationToken(params.token))
    .maybeSingle();

  if (error || !data) notFound();
  return <ChallengeInviteClient challenge={data as unknown as ChallengeWithRelations} invitationToken={params.token} />;
}
