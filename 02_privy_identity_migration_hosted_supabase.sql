-- =====================================================================
-- MIGRATION: Privy as sole identity provider (hosted Supabase safe)
-- =====================================================================
--
-- Hosted Supabase owns and manages auth.users. This variant does not
-- inspect, alter, or drop triggers from auth.users. It only updates
-- SkillFi-owned public schema objects and policies.
-- =====================================================================

DROP FUNCTION IF EXISTS public.handle_new_user();

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS privy_user_id text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_privy_user_id ON public.users (privy_user_id);

DROP POLICY IF EXISTS "users_owner_update" ON public.users;
DROP POLICY IF EXISTS "risk_profile_owner_read" ON public.user_risk_profiles;
DROP POLICY IF EXISTS "matches_create_challenge" ON public.matches;
DROP POLICY IF EXISTS "transactions_owner_read" ON public.transactions;
