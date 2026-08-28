create table if not exists public.match_audit_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete restrict,
  challenge_id uuid references public.challenges(id) on delete restrict,
  actor_user_id uuid references public.users(id) on delete restrict,
  event_type text not null,
  tx_hash text,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint match_audit_events_target_present check (match_id is not null or challenge_id is not null),
  constraint match_audit_events_tx_hash_format check (tx_hash is null or tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  constraint match_audit_events_idempotency_unique unique (idempotency_key)
);

create index if not exists idx_match_audit_events_match_created
  on public.match_audit_events (match_id, created_at desc);
create index if not exists idx_match_audit_events_actor_created
  on public.match_audit_events (actor_user_id, created_at desc);

alter table public.match_audit_events enable row level security;
revoke all on public.match_audit_events from anon, authenticated;
grant select, insert on public.match_audit_events to service_role;

create or replace function public.prevent_match_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'match audit events are immutable';
end;
$$;

drop trigger if exists match_audit_events_immutable on public.match_audit_events;
create trigger match_audit_events_immutable
before update or delete on public.match_audit_events
for each row execute function public.prevent_match_audit_mutation();

insert into public.match_audit_events (
  match_id,
  actor_user_id,
  event_type,
  idempotency_key,
  payload,
  created_at
)
select
  id,
  player_a_id,
  'match_state_snapshot',
  'match_state_snapshot:' || id::text,
  jsonb_build_object('status', status, 'winnerId', winner_id),
  updated_at
from public.matches
on conflict (idempotency_key) do nothing;
