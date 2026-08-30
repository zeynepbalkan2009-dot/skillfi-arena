create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  emblem text not null default '⬢',
  owner_user_id uuid not null references public.users(id) on delete restrict,
  join_policy text not null default 'open',
  treasury_balance numeric(78,0) not null default 0,
  season_influence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guilds_name_length check (char_length(name) between 3 and 48),
  constraint guilds_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint guilds_description_length check (char_length(description) <= 280),
  constraint guilds_join_policy_valid check (join_policy in ('open', 'approval', 'invite')),
  constraint guilds_treasury_nonnegative check (treasury_balance >= 0),
  constraint guilds_influence_nonnegative check (season_influence >= 0)
);

create table if not exists public.guild_members (
  guild_id uuid not null references public.guilds(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  role text not null default 'member',
  contribution_score integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (guild_id, user_id),
  constraint guild_members_role_valid check (role in ('owner', 'officer', 'member')),
  constraint guild_members_contribution_nonnegative check (contribution_score >= 0)
);
create unique index if not exists guild_members_one_owner on public.guild_members (guild_id) where role = 'owner';
create unique index if not exists guild_members_one_guild_per_user on public.guild_members (user_id);
create index if not exists guild_members_user on public.guild_members (user_id, joined_at desc);

create table if not exists public.guild_proposals (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete restrict,
  proposer_user_id uuid not null references public.users(id) on delete restrict,
  title text not null,
  description text not null,
  proposal_type text not null default 'strategy',
  amount numeric(78,0),
  status text not null default 'active',
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint guild_proposals_title_length check (char_length(title) between 5 and 100),
  constraint guild_proposals_description_length check (char_length(description) between 10 and 1000),
  constraint guild_proposals_type_valid check (proposal_type in ('strategy', 'treasury', 'membership')),
  constraint guild_proposals_status_valid check (status in ('active', 'passed', 'rejected', 'executed', 'cancelled')),
  constraint guild_proposals_amount_positive check (amount is null or amount > 0),
  constraint guild_proposals_closes_after_created check (closes_at > created_at)
);
create index if not exists guild_proposals_guild_created on public.guild_proposals (guild_id, created_at desc);

create table if not exists public.guild_votes (
  proposal_id uuid not null references public.guild_proposals(id) on delete restrict,
  voter_user_id uuid not null references public.users(id) on delete restrict,
  choice text not null,
  created_at timestamptz not null default now(),
  primary key (proposal_id, voter_user_id),
  constraint guild_votes_choice_valid check (choice in ('for', 'against', 'abstain'))
);

create table if not exists public.guild_treasury_events (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(id) on delete restrict,
  actor_user_id uuid references public.users(id) on delete restrict,
  proposal_id uuid references public.guild_proposals(id) on delete restrict,
  event_type text not null,
  amount numeric(78,0) not null default 0,
  tx_hash text,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint guild_treasury_amount_nonnegative check (amount >= 0),
  constraint guild_treasury_tx_hash_format check (tx_hash is null or tx_hash ~ '^0x[0-9a-fA-F]{64}$')
);
create index if not exists guild_treasury_events_guild_created on public.guild_treasury_events (guild_id, created_at desc);

drop trigger if exists trg_guilds_touch_updated_at on public.guilds;
create trigger trg_guilds_touch_updated_at before update on public.guilds
for each row execute function public.touch_updated_at();

create or replace function public.prevent_guild_ledger_mutation()
returns trigger language plpgsql as $$ begin raise exception 'guild treasury events are immutable'; end; $$;
drop trigger if exists guild_treasury_events_immutable on public.guild_treasury_events;
create trigger guild_treasury_events_immutable before update or delete on public.guild_treasury_events
for each row execute function public.prevent_guild_ledger_mutation();

alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
alter table public.guild_proposals enable row level security;
alter table public.guild_votes enable row level security;
alter table public.guild_treasury_events enable row level security;
revoke all on public.guilds, public.guild_members, public.guild_proposals, public.guild_votes, public.guild_treasury_events from anon, authenticated;
grant select, insert, update on public.guilds, public.guild_members, public.guild_proposals, public.guild_votes to service_role;
grant select, insert on public.guild_treasury_events to service_role;

create or replace function public.create_guild_with_owner(
  p_owner_user_id uuid, p_name text, p_slug text, p_description text, p_emblem text
) returns public.guilds language plpgsql security definer set search_path = public as $$
declare created_guild public.guilds;
begin
  if exists (select 1 from public.guild_members where user_id = p_owner_user_id) then
    raise exception 'player already belongs to a guild';
  end if;
  insert into public.guilds (owner_user_id, name, slug, description, emblem)
  values (p_owner_user_id, p_name, p_slug, p_description, p_emblem)
  returning * into created_guild;
  insert into public.guild_members (guild_id, user_id, role) values (created_guild.id, p_owner_user_id, 'owner');
  return created_guild;
end;
$$;
revoke all on function public.create_guild_with_owner(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_guild_with_owner(uuid,text,text,text,text) to service_role;
