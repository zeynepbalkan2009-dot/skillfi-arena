-- Prevent concurrent API requests from broadcasting duplicate operator settlement
-- transactions for the same match. A lease is claimed before any resolveMatch
-- write and the tx hash is recorded immediately after broadcast.

create table if not exists public.match_settlement_leases (
  match_id uuid primary key references public.matches(id) on delete cascade,
  lease_token uuid not null,
  lease_expires_at timestamptz not null,
  tx_hash text,
  updated_at timestamptz not null default now(),
  constraint match_settlement_leases_tx_hash_format check (
    tx_hash is null or tx_hash ~ '^0x[0-9a-fA-F]{64}$'
  )
);

alter table public.match_settlement_leases enable row level security;
revoke all on public.match_settlement_leases from anon, authenticated;
grant select, insert, update, delete on public.match_settlement_leases to service_role;

create or replace function public.claim_match_settlement(
  p_match_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer default 900
)
returns table (acquired boolean, tx_hash text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_expires timestamptz;
begin
  if p_match_id is null or p_lease_token is null then
    raise exception 'match id and lease token are required';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 1800 then
    raise exception 'invalid settlement lease duration';
  end if;

  v_expires := v_now + make_interval(secs => p_lease_seconds);

  return query
  insert into public.match_settlement_leases (match_id, lease_token, lease_expires_at, tx_hash, updated_at)
  values (p_match_id, p_lease_token, v_expires, null, v_now)
  on conflict (match_id) do update
  set lease_token = excluded.lease_token,
      lease_expires_at = excluded.lease_expires_at,
      updated_at = excluded.updated_at
  where public.match_settlement_leases.lease_expires_at <= v_now
    and public.match_settlement_leases.tx_hash is null
  returning true, public.match_settlement_leases.tx_hash;

  if found then
    return;
  end if;

  return query
  select false, l.tx_hash
  from public.match_settlement_leases l
  where l.match_id = p_match_id;
end;
$$;

create or replace function public.record_match_settlement_tx(
  p_match_id uuid,
  p_lease_token uuid,
  p_tx_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_tx_hash !~ '^0x[0-9a-fA-F]{64}$' then
    raise exception 'invalid settlement transaction hash';
  end if;

  update public.match_settlement_leases
  set tx_hash = lower(p_tx_hash),
      updated_at = now()
  where match_id = p_match_id
    and lease_token = p_lease_token
    and lease_expires_at > now()
    and tx_hash is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.release_match_settlement_lease(
  p_match_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.match_settlement_leases
  where match_id = p_match_id
    and lease_token = p_lease_token;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;

revoke all on function public.claim_match_settlement(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.record_match_settlement_tx(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.release_match_settlement_lease(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_match_settlement(uuid, uuid, integer) to service_role;
grant execute on function public.record_match_settlement_tx(uuid, uuid, text) to service_role;
grant execute on function public.release_match_settlement_lease(uuid, uuid) to service_role;

update public.schema_release_state
set version = 18,
    updated_at = now()
where id = 1;
