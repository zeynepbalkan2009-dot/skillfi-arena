import Link from "next/link";
import { ChallengeInviteClient } from "@/components/ChallengeInviteClient";
import { hashInvitationToken } from "@/lib/challenges/tokens";
import { supabase } from "@/lib/supabaseClient";
import type { ChallengeWithRelations } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ChallengePage({ params }: { params: { token: string } }) {
  const tokenHash = hashInvitationToken(params.token);
  const { data: challenge, error } = await (supabase as any)
    .from("challenges")
    .select(
      "id, game_id, creator_id, invited_opponent_id, accepted_by_id, match_id, entry_fee, currency, opponent_mode, rules, status, expires_at, accepted_at, created_at, updated_at, game:games(*), creator:users!challenges_creator_id_fkey(id,username,display_name,avatar_url,region,wallet_address,primary_wallet_address), invited_opponent:users!challenges_invited_opponent_id_fkey(id,username,display_name,avatar_url,region,wallet_address,primary_wallet_address), accepted_by:users!challenges_accepted_by_id_fkey(id,username,display_name,avatar_url,region,wallet_address,primary_wallet_address)"
    )
    .eq("invitation_token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("Failed to load invitation:", error.message);
  }

  if (!challenge) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link href="/" className="text-sm font-medium text-arena-muted hover:text-arena-text">
          Back to lobby
        </Link>
        <section className="mt-6 rounded-lg border border-arena-border bg-arena-surface p-6">
          <h1 className="font-display text-2xl font-bold text-arena-text">Invitation not found</h1>
          <p className="mt-2 text-sm text-arena-muted">
            This challenge link is invalid, expired, or no longer available.
          </p>
        </section>
      </main>
    );
  }

  return <ChallengeInviteClient challenge={challenge as unknown as ChallengeWithRelations} invitationToken={params.token} />;
}
