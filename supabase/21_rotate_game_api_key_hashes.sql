-- Prepare the integration-credential transition without breaking active studios.
-- Legacy credentials use an 8-character prefix and SHA-256 secret hash. New
-- credentials use a 12-hex-character prefix and scrypt-derived secret hash.
--
-- This migration is intentionally NON-DESTRUCTIVE: it permits both prefix
-- formats and makes prefix lookup unique so replacement scrypt credentials can
-- be created and distributed before the cutover. Legacy credentials remain
-- active until schema 22 explicitly revokes only the legacy prefix format.

begin;

alter table public.game_api_credentials
  drop constraint if exists game_api_credentials_prefix_format;

alter table public.game_api_credentials
  add constraint game_api_credentials_prefix_format
  check (
    key_prefix ~ '^sk_(test|live)_([a-zA-Z0-9]{8}|[0-9a-f]{12})$'
  );

-- New authentication resolves credentials by prefix before running scrypt.
-- Fail the migration transaction if historical duplicate prefixes exist rather
-- than silently leaving lookup ambiguous.
create unique index if not exists game_api_credentials_key_prefix_unique
  on public.game_api_credentials (key_prefix);

update public.schema_release_state
set version = 21,
    updated_at = now()
where id = 1;

commit;
