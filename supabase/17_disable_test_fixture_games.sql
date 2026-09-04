-- Remove test-fixture games from the production-facing catalog without deleting audit history.

update public.games
set is_active = false,
    integration_status = 'suspended'
where name ilike 'HTTP Validation %';

update public.schema_release_state
set version = 17,
    updated_at = now()
where id = 1;
