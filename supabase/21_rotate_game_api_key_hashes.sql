-- New integration credentials use a 12-hex-character random key prefix and a
-- deterministic scrypt-derived secret hash. Existing SHA-256 credential hashes
-- cannot be upgraded without the original secret, so revoke them fail-closed
-- and require studios to create replacement credentials after this migration.

begin;

update public.game_api_credentials
set revoked_at = coalesce(revoked_at, now())
where revoked_at is null;

alter table public.game_api_credentials
  drop constraint if exists game_api_credentials_prefix_format;

alter table public.game_api_credentials
  add constraint game_api_credentials_prefix_format
  check (
    key_prefix ~ '^sk_(test|live)_([a-zA-Z0-9]{8}|[0-9a-f]{12})$'
  );

create unique index if not exists game_api_credentials_key_prefix_unique
  on public.game_api_credentials (key_prefix);

update public.schema_release_state
set version = 21,
    updated_at = now()
where id = 1;

commit;
