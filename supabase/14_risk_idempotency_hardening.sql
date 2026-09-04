-- Make stake reservations truly idempotent and fail closed after release/confirmation.

create or replace function public.reserve_daily_stake(
  p_user_id uuid,
  p_amount numeric,
  p_idempotency_key text
)
returns table (allowed boolean, reason text, stake_used numeric, loss_used numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.user_risk_profiles%rowtype;
  v_stake_used numeric := 0;
  v_loss_used numeric := 0;
  v_existing public.risk_stake_reservations%rowtype;
begin
  if p_amount <= 0 then raise exception 'invalid stake amount'; end if;

  select * into v_existing
  from public.risk_stake_reservations
  where idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.user_id <> p_user_id or v_existing.amount <> p_amount then
      raise exception 'idempotency key conflict';
    end if;

    if v_existing.status <> 'reserved' then
      return query select false, 'idempotency key already finalized', 0::numeric, 0::numeric;
      return;
    end if;

    if v_existing.match_id is not null then
      return query select false, 'idempotency key already attached to a match', 0::numeric, 0::numeric;
      return;
    end if;

    return query select true, 'existing pending reservation', 0::numeric, 0::numeric;
    return;
  end if;

  insert into public.user_risk_profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_profile
  from public.user_risk_profiles
  where user_id = p_user_id
  for update;

  if v_profile.is_restricted then
    return query select false, 'account restricted', 0::numeric, 0::numeric;
    return;
  end if;

  select coalesce(sum(amount), 0) into v_stake_used
  from public.risk_stake_reservations
  where user_id = p_user_id
    and status in ('reserved', 'confirmed')
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';

  select coalesce(sum(stake_amount), 0) into v_loss_used
  from public.matches
  where status = 'completed'
    and winner_id is distinct from p_user_id
    and (player_a_id = p_user_id or player_b_id = p_user_id)
    and updated_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';

  if v_profile.daily_stake_limit > 0 and v_stake_used + p_amount > v_profile.daily_stake_limit then
    return query select false, 'daily stake limit exceeded', v_stake_used, v_loss_used;
    return;
  end if;
  if v_profile.daily_loss_limit > 0 and v_loss_used >= v_profile.daily_loss_limit then
    return query select false, 'daily loss limit reached', v_stake_used, v_loss_used;
    return;
  end if;

  insert into public.risk_stake_reservations (user_id, idempotency_key, amount)
  values (p_user_id, p_idempotency_key, p_amount);

  return query select true, 'reserved', v_stake_used + p_amount, v_loss_used;
end;
$$;

revoke all on function public.reserve_daily_stake(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.reserve_daily_stake(uuid, numeric, text) to service_role;
