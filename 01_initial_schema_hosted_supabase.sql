-- =====================================================================
-- MIGRATION: Initial SkillFi Arena schema (hosted Supabase safe)
-- =====================================================================
--
-- Hosted Supabase owns and manages the auth schema. This migration creates
-- only SkillFi application objects in public and does not create, alter, or
-- attach triggers to auth.users.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  region text NOT NULL DEFAULT 'EU',
  wallet_address text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_region_valid CHECK (region IN ('EU', 'NA', 'ASIA')),
  CONSTRAINT users_wallet_address_format CHECK (
    wallet_address IS NULL OR wallet_address ~* '^0x[a-f0-9]{40}$'
  )
);

CREATE TABLE IF NOT EXISTS public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'web2',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT games_type_valid CHECK (type IN ('web2', 'web3'))
);

CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_contract_match_id text UNIQUE,
  game_id uuid NOT NULL REFERENCES public.games(id),
  player_a_id uuid NOT NULL REFERENCES public.users(id),
  player_b_id uuid REFERENCES public.users(id),
  stake_amount numeric(78,0) NOT NULL,
  status text NOT NULL DEFAULT 'searching',
  winner_id uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matches_stake_amount_nonnegative CHECK (stake_amount >= 0),
  CONSTRAINT matches_status_valid CHECK (
    status IN ('searching', 'waiting_on_chain', 'active', 'settling', 'completed', 'cancelled')
  ),
  CONSTRAINT matches_player_b_not_player_a CHECK (player_b_id IS NULL OR player_b_id <> player_a_id),
  CONSTRAINT matches_winner_is_participant CHECK (
    winner_id IS NULL OR winner_id = player_a_id OR winner_id = player_b_id
  )
);

CREATE TABLE IF NOT EXISTS public.user_risk_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  daily_stake_limit numeric(78,0) NOT NULL DEFAULT 0,
  daily_loss_limit numeric(78,0) NOT NULL DEFAULT 0,
  is_restricted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_risk_profiles_daily_stake_limit_nonnegative CHECK (daily_stake_limit >= 0),
  CONSTRAINT user_risk_profiles_daily_loss_limit_nonnegative CHECK (daily_loss_limit >= 0)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  tx_hash text UNIQUE,
  kind text NOT NULL DEFAULT 'unknown',
  amount numeric(78,0),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transactions_amount_nonnegative CHECK (amount IS NULL OR amount >= 0),
  CONSTRAINT transactions_status_valid CHECK (status IN ('pending', 'confirmed', 'failed')),
  CONSTRAINT transactions_kind_valid CHECK (
    kind IN ('unknown', 'create_match', 'join_match', 'settlement', 'refund', 'fee')
  )
);

CREATE INDEX IF NOT EXISTS idx_users_wallet_address
  ON public.users (lower(wallet_address))
  WHERE wallet_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_games_active_name
  ON public.games (is_active, name);

CREATE INDEX IF NOT EXISTS idx_matches_status_created_at
  ON public.matches (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_matches_game_id
  ON public.matches (game_id);

CREATE INDEX IF NOT EXISTS idx_matches_player_a_id
  ON public.matches (player_a_id);

CREATE INDEX IF NOT EXISTS idx_matches_player_b_id
  ON public.matches (player_b_id)
  WHERE player_b_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created_at
  ON public.transactions (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_match_id
  ON public.transactions (match_id)
  WHERE match_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matches_touch_updated_at ON public.matches;
CREATE TRIGGER trg_matches_touch_updated_at
BEFORE UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_user_risk_profiles_touch_updated_at ON public.user_risk_profiles;
CREATE TRIGGER trg_user_risk_profiles_touch_updated_at
BEFORE UPDATE ON public.user_risk_profiles
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_touch_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_touch_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_risk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_public_read" ON public.users;
CREATE POLICY "users_public_read"
ON public.users
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "users_owner_update" ON public.users;
CREATE POLICY "users_owner_update"
ON public.users
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "games_public_read" ON public.games;
CREATE POLICY "games_public_read"
ON public.games
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "matches_public_read" ON public.matches;
CREATE POLICY "matches_public_read"
ON public.matches
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "matches_create_challenge" ON public.matches;
CREATE POLICY "matches_create_challenge"
ON public.matches
FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "risk_profile_owner_read" ON public.user_risk_profiles;
CREATE POLICY "risk_profile_owner_read"
ON public.user_risk_profiles
FOR SELECT
TO authenticated
USING (false);

DROP POLICY IF EXISTS "transactions_owner_read" ON public.transactions;
CREATE POLICY "transactions_owner_read"
ON public.transactions
FOR SELECT
TO authenticated
USING (false);

DROP POLICY IF EXISTS "users_service_role_all" ON public.users;
CREATE POLICY "users_service_role_all"
ON public.users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "games_service_role_all" ON public.games;
CREATE POLICY "games_service_role_all"
ON public.games
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "matches_service_role_all" ON public.matches;
CREATE POLICY "matches_service_role_all"
ON public.matches
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "risk_profiles_service_role_all" ON public.user_risk_profiles;
CREATE POLICY "risk_profiles_service_role_all"
ON public.user_risk_profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "transactions_service_role_all" ON public.transactions;
CREATE POLICY "transactions_service_role_all"
ON public.transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.users TO anon, authenticated;
GRANT SELECT ON public.games TO anon, authenticated;
GRANT SELECT ON public.matches TO anon, authenticated;

GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.games TO service_role;
GRANT ALL ON public.matches TO service_role;
GRANT ALL ON public.user_risk_profiles TO service_role;
GRANT ALL ON public.transactions TO service_role;
