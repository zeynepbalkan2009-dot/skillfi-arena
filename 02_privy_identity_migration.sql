-- =====================================================================
-- MIGRATION: Privy as sole identity provider (decouple from auth.users)
-- =====================================================================
--
-- WHY THIS MIGRATION EXISTS:
--
-- The original schema's `public.users.id` was a foreign key into
-- `auth.users(id)`, and RLS policies leaned on `auth.uid() = ...` —
-- i.e. it assumed Supabase Auth was the session/identity source.
--
-- Privy is not one of Supabase's supported Third-Party Auth providers
-- (Clerk, Firebase Auth, Auth0, AWS Cognito, WorkOS — Privy is not on
-- that list), and Privy's access token `sub` claim is a Privy DID
-- string (e.g. "did:privy:cl812utgs..."), not a UUID, and carries no
-- `role` claim. Handing a Privy token to the Supabase client as a
-- Bearer token does NOT make `auth.uid()` resolve to anything — worse,
-- `auth.uid()`'s `::uuid` cast on a DID string throws outright, so
-- every RLS-gated query would error rather than just being denied.
--
-- This migration moves identity resolution entirely server-side:
-- Privy tokens are verified with @privy-io/node, resolved to a
-- `public.users` row by `privy_user_id`, and all access (read or
-- write) to anything privacy-sensitive goes through a Route Handler
-- using `service_role` — the same pattern already used for match
-- creation in app/api/matches/create/route.ts, just extended to be
-- the ONLY identity path rather than a special case.
--
-- WHAT STAYS THE SAME: public read access (users' public fields,
-- games, ratings, searching matches) is still served directly via the
-- anon client — none of that depended on auth.uid() in the first
-- place, so it's untouched.
--
-- WHAT CHANGES: anything that was gated by `auth.uid() = ...` (owner
-- profile updates, risk-profile reads, transaction history reads,
-- challenge creation) no longer has a client-reachable policy at all
-- for anon/authenticated — by design. There is deliberately no
-- replacement "trust this header" policy, because Postgres has no way
-- to verify a Privy signature; that verification can only happen in
-- the Node process running @privy-io/node, before it ever reaches
-- Postgres. Those operations now require a server route. See
-- app/api/matches/create/route.ts for the canonical example of that
-- pattern; the same shape applies to any future "my profile" /
-- "my transactions" endpoints.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Drop the auth.users -> public.users provisioning trigger.
--    There is no guarantee a Privy-authenticated user ever has a
--    corresponding auth.users row, so nothing should depend on that
--    insert firing anymore. Account provisioning now happens in
--    app/api/auth/sync/route.ts (find-or-create by privy_user_id).
-- ---------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. Detach public.users.id from auth.users, add privy_user_id.
-- ---------------------------------------------------------------------

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS privy_user_id text UNIQUE;

-- A Privy-authenticated user always has a privy_user_id; the column is
-- nullable only so this migration doesn't fail against any pre-existing
-- rows that predate Privy integration. New rows created through the
-- account-sync route always populate it (enforced at the application
-- layer, not the DB layer, intentionally — see note below).
--
-- NOTE: not marked NOT NULL here on purpose. If you're running this on
-- a fresh database with no pre-Privy rows, feel free to tighten this to
-- `ALTER COLUMN privy_user_id SET NOT NULL` after confirming the table
-- is empty or fully backfilled.

CREATE INDEX IF NOT EXISTS idx_users_privy_user_id ON public.users (privy_user_id);

-- ---------------------------------------------------------------------
-- 3. Replace the auth.uid()-based policies with service_role-only
--    access for everything that was previously owner-gated.
--    Public read policies are untouched (re-stated here only where a
--    DROP was necessary to remove the now-meaningless owner policy).
-- ---------------------------------------------------------------------

-- users: public read stays; owner-update via auth.uid() is gone (no
-- replacement client-side policy — profile edits go through a server
-- route once that feature exists, same pattern as match creation).
DROP POLICY IF EXISTS "users_owner_update" ON public.users;

-- user_risk_profiles: owner-read via auth.uid() is gone. There was
-- never a client-side write policy here (by original design), so only
-- the read policy needs dropping. Reads now require a server route
-- that verifies the Privy token and queries by the resolved user_id.
DROP POLICY IF EXISTS "risk_profile_owner_read" ON public.user_risk_profiles;

-- matches: the auth.uid()-gated insert policy is gone. Challenge
-- creation already goes through app/api/matches/create/route.ts with
-- service_role — this just removes the now-permanently-unreachable
-- client-side path instead of leaving dead policy code around.
DROP POLICY IF EXISTS "matches_create_challenge" ON public.matches;

-- transactions: owner-read via auth.uid() is gone. Same as risk
-- profiles — reads now require a server route.
DROP POLICY IF EXISTS "transactions_owner_read" ON public.transactions;

-- Every table's `..._service_role_all` policy (added in the original
-- schema script) is untouched and is now the only write path for
-- anything in this migration's scope — service_role already bypasses
-- RLS in Supabase regardless, but the explicit policies remain as
-- documentation of intent, consistent with the original schema script.
