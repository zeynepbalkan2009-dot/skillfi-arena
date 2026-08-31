create table if not exists public.beta_pilot_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete restrict,
  status text not null default 'applied',
  terms_version text not null,
  privacy_version text not null,
  adult_attested_at timestamptz not null,
  consented_at timestamptz not null,
  activated_at timestamptz,
  completed_at timestamptz,
  withdrawn_at timestamptz,
  reviewed_by_user_id uuid references public.users(id) on delete restrict,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beta_pilot_status_valid check (status in ('applied','active','completed','withdrawn','rejected')),
  constraint beta_pilot_terms_version_length check (char_length(terms_version) between 1 and 40),
  constraint beta_pilot_privacy_version_length check (char_length(privacy_version) between 1 and 40),
  constraint beta_pilot_review_note_length check (char_length(review_note) <= 500)
);

create index if not exists beta_pilot_status_created on public.beta_pilot_enrollments (status, created_at);
drop trigger if exists trg_beta_pilot_touch_updated_at on public.beta_pilot_enrollments;
create trigger trg_beta_pilot_touch_updated_at before update on public.beta_pilot_enrollments
for each row execute function public.touch_updated_at();

alter table public.beta_pilot_enrollments enable row level security;
revoke all on public.beta_pilot_enrollments from anon, authenticated;
grant select, insert, update on public.beta_pilot_enrollments to service_role;

create or replace function public.activate_beta_participant(
  p_enrollment_id uuid,
  p_admin_user_id uuid,
  p_review_note text default ''
) returns public.beta_pilot_enrollments
language plpgsql security definer set search_path = public as $$
declare enrollment public.beta_pilot_enrollments;
begin
  if (select count(*) from public.beta_pilot_enrollments where status = 'active') >= 100 then
    raise exception 'beta pilot capacity reached';
  end if;
  update public.beta_pilot_enrollments
     set status = 'active', activated_at = now(), reviewed_by_user_id = p_admin_user_id,
         review_note = left(coalesce(p_review_note, ''), 500)
   where id = p_enrollment_id and status = 'applied'
   returning * into enrollment;
  if enrollment.id is null then raise exception 'enrollment is not awaiting review'; end if;
  return enrollment;
end;
$$;
revoke all on function public.activate_beta_participant(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.activate_beta_participant(uuid,uuid,text) to service_role;
