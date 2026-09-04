-- Public match clients now use explicit PostgREST/server projections and polling.
-- Remove public.matches from logical replication so full-row Realtime payloads
-- cannot become an alternate data-exposure path when client/library behavior drifts.

begin;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime drop table public.matches;
  end if;
end $$;

update public.schema_release_state
set version = 20,
    updated_at = now()
where id = 1;

commit;
