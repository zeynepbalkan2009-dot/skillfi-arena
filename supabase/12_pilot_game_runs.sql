create table if not exists public.beta_pilot_game_runs (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.beta_pilot_enrollments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  game_slug text not null,
  score_percent integer not null check (score_percent between 0 and 100),
  duration_ms integer not null check (duration_ms between 1000 and 600000),
  feedback_rating integer check (feedback_rating between 1 and 5),
  feedback_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beta_pilot_game_slug_valid check (game_slug in ('typing-sprint','arithmetic-rush','sequence-recall','pattern-lock','logic-grid')),
  constraint beta_pilot_feedback_note_length check (char_length(feedback_note) <= 1000),
  constraint beta_pilot_game_user_unique unique (user_id, game_slug)
);

create index if not exists beta_pilot_runs_enrollment_created on public.beta_pilot_game_runs (enrollment_id, created_at desc);
drop trigger if exists trg_beta_pilot_game_runs_touch_updated_at on public.beta_pilot_game_runs;
create trigger trg_beta_pilot_game_runs_touch_updated_at before update on public.beta_pilot_game_runs
for each row execute function public.touch_updated_at();

alter table public.beta_pilot_game_runs enable row level security;
revoke all on public.beta_pilot_game_runs from anon, authenticated;
grant select, insert, update on public.beta_pilot_game_runs to service_role;
