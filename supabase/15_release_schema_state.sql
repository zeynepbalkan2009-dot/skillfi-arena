-- Canonical hosted schema marker used by release readiness checks.

create table if not exists public.schema_release_state (
  id smallint primary key default 1 check (id = 1),
  version integer not null check (version > 0),
  updated_at timestamptz not null default now()
);

alter table public.schema_release_state enable row level security;
revoke all on public.schema_release_state from anon, authenticated;
grant select, insert, update on public.schema_release_state to service_role;

insert into public.schema_release_state (id, version, updated_at)
values (1, 15, now())
on conflict (id) do update
set version = excluded.version,
    updated_at = excluded.updated_at;
