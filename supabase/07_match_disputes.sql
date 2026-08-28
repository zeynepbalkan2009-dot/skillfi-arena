alter table public.matches
  drop constraint if exists matches_status_valid;

alter table public.matches
  add constraint matches_status_valid check (
    status in ('searching', 'waiting_on_chain', 'active', 'settling', 'disputed', 'completed', 'cancelled')
  );
