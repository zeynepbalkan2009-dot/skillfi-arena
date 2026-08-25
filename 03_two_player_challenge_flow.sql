-- =====================================================================
-- MIGRATION: Two-player profile, challenge, invitation, and match flow
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS primary_wallet_address text,
  ADD COLUMN IF NOT EXISTS wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS losses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matches_played integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS elo_rating integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS total_earnings numeric(78,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

DO $$
BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_wins_nonnegative CHECK (wins >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_losses_nonnegative CHECK (losses >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_matches_played_nonnegative CHECK (matches_played >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_elo_rating_positive CHECK (elo_rating > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_total_earnings_nonnegative CHECK (total_earnings >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email
  ON public.users (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_primary_wallet_address
  ON public.users (lower(primary_wallet_address))
  WHERE primary_wallet_address IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_token_hash text NOT NULL UNIQUE,
  idempotency_key text,
  game_id uuid NOT NULL REFERENCES public.games(id),
  creator_id uuid NOT NULL REFERENCES public.users(id),
  invited_opponent_id uuid REFERENCES public.users(id),
  accepted_by_id uuid REFERENCES public.users(id),
  match_id uuid,
  entry_fee numeric(78,0) NOT NULL,
  currency text NOT NULL DEFAULT 'USDC',
  opponent_mode text NOT NULL DEFAULT 'open',
  rules text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenges_entry_fee_positive CHECK (entry_fee > 0),
  CONSTRAINT challenges_currency_usdc CHECK (currency = 'USDC'),
  CONSTRAINT challenges_opponent_mode_valid CHECK (opponent_mode IN ('open', 'invite')),
  CONSTRAINT challenges_status_valid CHECK (status IN ('open', 'accepted', 'expired', 'cancelled')),
  CONSTRAINT challenges_invited_when_invite CHECK (
    (opponent_mode = 'open' AND invited_opponent_id IS NULL)
    OR (opponent_mode = 'invite' AND invited_opponent_id IS NOT NULL)
  ),
  CONSTRAINT challenges_no_self_invite CHECK (invited_opponent_id IS NULL OR invited_opponent_id <> creator_id),
  CONSTRAINT challenges_accepted_by_not_creator CHECK (accepted_by_id IS NULL OR accepted_by_id <> creator_id)
);

CREATE INDEX IF NOT EXISTS idx_challenges_status_expires_at
  ON public.challenges (status, expires_at);

CREATE INDEX IF NOT EXISTS idx_challenges_creator_id
  ON public.challenges (creator_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_creator_id_idempotency_key
  ON public.challenges (creator_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_challenges_invited_opponent_id
  ON public.challenges (invited_opponent_id)
  WHERE invited_opponent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_challenges_invitation_token_hash
  ON public.challenges (invitation_token_hash);

CREATE TABLE IF NOT EXISTS public.challenge_participants (
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id),
  CONSTRAINT challenge_participants_role_valid CHECK (role IN ('creator', 'invitee', 'accepted'))
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_user_id
  ON public.challenge_participants (user_id);

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS challenge_id uuid REFERENCES public.challenges(id),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS rules text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USDC';

CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_challenge_id
  ON public.matches (challenge_id)
  WHERE challenge_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.match_participants (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  side text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id),
  CONSTRAINT match_participants_side_valid CHECK (side IN ('player_a', 'player_b'))
);

CREATE INDEX IF NOT EXISTS idx_match_participants_user_id
  ON public.match_participants (user_id);

DO $$
BEGIN
  ALTER TABLE public.challenges
    ADD CONSTRAINT challenges_match_id_fkey
    FOREIGN KEY (match_id) REFERENCES public.matches(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenges_touch_updated_at ON public.challenges;
CREATE TRIGGER trg_challenges_touch_updated_at
BEFORE UPDATE ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.accept_challenge(
  p_challenge_id uuid,
  p_player_id uuid
)
RETURNS TABLE(challenge_id uuid, match_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge public.challenges%ROWTYPE;
  v_match_id uuid;
BEGIN
  SELECT *
    INTO v_challenge
    FROM public.challenges
   WHERE id = p_challenge_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'challenge not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_player_id) THEN
    RAISE EXCEPTION 'player not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_challenge.creator_id = p_player_id THEN
    RAISE EXCEPTION 'creator cannot accept own challenge' USING ERRCODE = 'P0001';
  END IF;

  IF v_challenge.status <> 'open' THEN
    RAISE EXCEPTION 'challenge is not open' USING ERRCODE = 'P0001';
  END IF;

  IF v_challenge.expires_at <= now() THEN
    UPDATE public.challenges
       SET status = 'expired'
     WHERE id = p_challenge_id;
    RAISE EXCEPTION 'challenge has expired' USING ERRCODE = 'P0001';
  END IF;

  IF v_challenge.opponent_mode = 'invite'
     AND v_challenge.invited_opponent_id IS DISTINCT FROM p_player_id THEN
    RAISE EXCEPTION 'challenge is invite-only' USING ERRCODE = 'P0001';
  END IF;

  SELECT m.id INTO v_match_id
    FROM public.matches m
   WHERE m.challenge_id = p_challenge_id
   FOR UPDATE;

  IF v_match_id IS NULL THEN
    INSERT INTO public.matches (
      challenge_id,
      game_id,
      player_a_id,
      player_b_id,
      stake_amount,
      status,
      accepted_at,
      expires_at,
      rules,
      currency
    )
    VALUES (
      p_challenge_id,
      v_challenge.game_id,
      v_challenge.creator_id,
      p_player_id,
      v_challenge.entry_fee,
      'active',
      now(),
      v_challenge.expires_at,
      v_challenge.rules,
      v_challenge.currency
    )
    RETURNING id INTO v_match_id;
  END IF;

  UPDATE public.challenges
     SET status = 'accepted',
         accepted_by_id = p_player_id,
         accepted_at = now(),
         match_id = v_match_id
   WHERE id = p_challenge_id
     AND status = 'open';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'challenge was accepted concurrently' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.challenge_participants (challenge_id, user_id, role)
  VALUES
    (p_challenge_id, v_challenge.creator_id, 'creator'),
    (p_challenge_id, p_player_id, 'accepted')
  ON CONFLICT ON CONSTRAINT challenge_participants_pkey DO NOTHING;

  INSERT INTO public.match_participants (match_id, user_id, side)
  VALUES
    (v_match_id, v_challenge.creator_id, 'player_a'),
    (v_match_id, p_player_id, 'player_b')
  ON CONFLICT ON CONSTRAINT match_participants_pkey DO NOTHING;

  RETURN QUERY SELECT p_challenge_id, v_match_id;
END;
$$;

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges_public_read" ON public.challenges;
CREATE POLICY "challenges_public_read"
ON public.challenges
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "challenge_participants_public_read" ON public.challenge_participants;
CREATE POLICY "challenge_participants_public_read"
ON public.challenge_participants
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "match_participants_public_read" ON public.match_participants;
CREATE POLICY "match_participants_public_read"
ON public.match_participants
FOR SELECT
TO anon, authenticated
USING (true);

REVOKE ALL ON public.challenges FROM anon, authenticated;
GRANT SELECT (
  id,
  game_id,
  creator_id,
  invited_opponent_id,
  accepted_by_id,
  match_id,
  entry_fee,
  currency,
  opponent_mode,
  rules,
  status,
  expires_at,
  accepted_at,
  created_at,
  updated_at
) ON public.challenges TO anon, authenticated;

REVOKE ALL ON public.challenge_participants FROM anon, authenticated;
GRANT SELECT ON public.challenge_participants TO anon, authenticated;

REVOKE ALL ON public.match_participants FROM anon, authenticated;
GRANT SELECT ON public.match_participants TO anon, authenticated;

REVOKE ALL ON FUNCTION public.accept_challenge(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_challenge(uuid, uuid) TO service_role;
