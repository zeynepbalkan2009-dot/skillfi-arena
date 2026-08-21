-- Live match state is written only by the server-side API.
create table if not exists public.match_submissions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  typed_text text not null,
  elapsed_ms integer not null check (elapsed_ms between 1000 and 120000),
  typed_chars integer not null check (typed_chars >= 0),
  correct_chars integer not null check (correct_chars >= 0 and correct_chars <= typed_chars),
  wpm numeric(10,2) not null check (wpm >= 0),
  accuracy numeric(6,4) not null check (accuracy >= 0 and accuracy <= 1),
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);

alter table public.match_submissions enable row level security;
revoke all on public.match_submissions from anon, authenticated;
grant all on public.match_submissions to service_role;

alter table public.matches add column if not exists started_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches') then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
