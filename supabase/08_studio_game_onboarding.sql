create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.users(id) on delete restrict,
  name text not null,
  slug text not null unique,
  website_url text,
  contact_email text,
  status text not null default 'pending_payment',
  listing_fee_amount numeric(78,0) not null,
  listing_fee_currency text not null default 'USDC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint studios_name_length check (char_length(name) between 2 and 80),
  constraint studios_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint studios_status_valid check (status in ('pending_payment', 'pending_review', 'approved', 'rejected', 'suspended')),
  constraint studios_fee_nonnegative check (listing_fee_amount >= 0),
  constraint studios_currency_usdc check (listing_fee_currency = 'USDC')
);

alter table public.games add column if not exists studio_id uuid references public.studios(id) on delete restrict;
alter table public.games add column if not exists slug text;
alter table public.games add column if not exists description text;
alter table public.games add column if not exists website_url text;
alter table public.games add column if not exists integration_status text not null default 'published';
alter table public.games add column if not exists created_by_user_id uuid references public.users(id) on delete restrict;
alter table public.games drop constraint if exists games_integration_status_valid;
alter table public.games add constraint games_integration_status_valid
  check (integration_status in ('draft', 'submitted', 'sandbox', 'published', 'rejected', 'suspended'));
create unique index if not exists games_slug_unique on public.games (slug) where slug is not null;
create index if not exists games_studio_created on public.games (studio_id, created_at desc);

create table if not exists public.studio_fee_payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete restrict,
  payer_user_id uuid not null references public.users(id) on delete restrict,
  tx_hash text not null unique,
  token_address text not null,
  treasury_address text not null,
  amount numeric(78,0) not null,
  chain_id bigint not null,
  status text not null default 'confirmed',
  created_at timestamptz not null default now(),
  constraint studio_fee_tx_hash_format check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  constraint studio_fee_token_format check (token_address ~ '^0x[0-9a-fA-F]{40}$'),
  constraint studio_fee_treasury_format check (treasury_address ~ '^0x[0-9a-fA-F]{40}$'),
  constraint studio_fee_amount_positive check (amount > 0),
  constraint studio_fee_status_valid check (status in ('confirmed', 'refunded'))
);
create index if not exists studio_fee_payments_studio_created
  on public.studio_fee_payments (studio_id, created_at desc);

create table if not exists public.studio_audit_events (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete restrict,
  game_id uuid references public.games(id) on delete restrict,
  actor_user_id uuid references public.users(id) on delete restrict,
  event_type text not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists studio_audit_events_studio_created
  on public.studio_audit_events (studio_id, created_at desc);

drop trigger if exists trg_studios_touch_updated_at on public.studios;
create trigger trg_studios_touch_updated_at before update on public.studios
for each row execute function public.touch_updated_at();

alter table public.studios enable row level security;
alter table public.studio_fee_payments enable row level security;
alter table public.studio_audit_events enable row level security;
revoke all on public.studios, public.studio_fee_payments, public.studio_audit_events from anon, authenticated;
grant select, insert, update on public.studios to service_role;
grant select, insert, update on public.studio_fee_payments to service_role;
grant select, insert on public.studio_audit_events to service_role;

create or replace function public.prevent_studio_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'studio audit events are immutable';
end;
$$;
drop trigger if exists studio_audit_events_immutable on public.studio_audit_events;
create trigger studio_audit_events_immutable before update or delete on public.studio_audit_events
for each row execute function public.prevent_studio_audit_mutation();

create table if not exists public.game_api_credentials (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete restrict,
  studio_id uuid not null references public.studios(id) on delete restrict,
  name text not null,
  key_prefix text not null,
  secret_hash text not null unique,
  scopes text[] not null default array['game:read']::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint game_api_credentials_name_length check (char_length(name) between 2 and 80),
  constraint game_api_credentials_prefix_format check (key_prefix ~ '^sk_(test|live)_[a-zA-Z0-9]{8}$'),
  constraint game_api_credentials_hash_format check (secret_hash ~ '^[0-9a-f]{64}$'),
  constraint game_api_credentials_scopes_valid check (scopes <@ array['game:read', 'results:write']::text[])
);
create index if not exists game_api_credentials_game_created
  on public.game_api_credentials (game_id, created_at desc);

alter table public.game_api_credentials enable row level security;
revoke all on public.game_api_credentials from anon, authenticated;
grant select, insert, update on public.game_api_credentials to service_role;

drop policy if exists "games_public_read" on public.games;
create policy "games_public_read" on public.games for select to anon, authenticated
using (is_active = true and integration_status = 'published');

revoke insert, update, delete on public.games from anon, authenticated;
grant select, insert, update on public.games to service_role;
