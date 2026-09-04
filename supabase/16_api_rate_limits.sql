-- Server-side fixed-window rate limiting for sensitive API operations.

create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.api_rate_limits%rowtype;
  v_now timestamptz := now();
  v_window interval;
begin
  if length(p_bucket_key) < 16 or length(p_bucket_key) > 128 then
    raise exception 'invalid rate limit key';
  end if;
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid rate limit';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit window';
  end if;

  v_window := make_interval(secs => p_window_seconds);

  insert into public.api_rate_limits (bucket_key, window_started_at, request_count, updated_at)
  values (p_bucket_key, v_now, 1, v_now)
  on conflict (bucket_key) do update
  set
    window_started_at = case
      when public.api_rate_limits.window_started_at + v_window <= v_now then v_now
      else public.api_rate_limits.window_started_at
    end,
    request_count = case
      when public.api_rate_limits.window_started_at + v_window <= v_now then 1
      else public.api_rate_limits.request_count + 1
    end,
    updated_at = v_now
  returning * into v_row;

  if v_row.request_count <= p_limit then
    return query select true, greatest(p_limit - v_row.request_count, 0), 0;
  end if;

  return query select
    false,
    0,
    greatest(ceil(extract(epoch from ((v_row.window_started_at + v_window) - v_now)))::integer, 1);
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

update public.schema_release_state
set version = 16,
    updated_at = now()
where id = 1;
