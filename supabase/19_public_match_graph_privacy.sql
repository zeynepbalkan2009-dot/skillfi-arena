-- Close the remaining anonymous social/economic graph exposed by the original
-- challenge flow. Public pages now use server-side, explicitly projected APIs
-- for challenge data. The only direct match columns retained are those required
-- by the live/public match UI and its Realtime status refresh.

begin;

-- Challenges are token- or authenticated-flow data. There is no reason for an
-- arbitrary Supabase client to enumerate challenge rows or participant links.
drop policy if exists "challenges_public_read" on public.challenges;
drop policy if exists "challenge_participants_public_read" on public.challenge_participants;
drop policy if exists "match_participants_public_read" on public.match_participants;

revoke all on public.challenges from anon, authenticated;
revoke all on public.challenge_participants from anon, authenticated;
revoke all on public.match_participants from anon, authenticated;

-- Matches remain visible only through the minimal column set required by the
-- public/live client. In particular, challenge linkage and free-form rule/context
-- columns are no longer directly enumerable through the public Supabase key.
revoke all on public.matches from anon, authenticated;
grant select (
  id,
  smart_contract_match_id,
  game_id,
  player_a_id,
  player_b_id,
  stake_amount,
  status,
  winner_id,
  started_at,
  created_at,
  updated_at
) on public.matches to anon, authenticated;

update public.schema_release_state
set version = 19,
    updated_at = now()
where id = 1;

commit;
