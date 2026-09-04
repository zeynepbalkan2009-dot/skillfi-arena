-- Harden public profile exposure: remove table-wide access to public.users
-- and expose only explicitly public fields.

revoke all on public.users from anon, authenticated;

drop policy if exists "users_public_read" on public.users;
create policy "users_public_read"
on public.users
for select
to anon, authenticated
using (true);

grant select (
  id,
  username,
  display_name,
  avatar_url,
  region,
  wins,
  losses,
  matches_played,
  elo_rating,
  created_at
) on public.users to anon, authenticated;

create or replace view public.public_profiles
with (security_invoker = true)
as
select
  id,
  username,
  display_name,
  avatar_url,
  region,
  wins,
  losses,
  matches_played,
  elo_rating,
  created_at
from public.users;

revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

comment on view public.public_profiles is
  'Public-safe SkillFi profile projection. Never add email, Privy IDs, login timestamps, earnings or private wallet fields here.';
