-- Finalize the integration-credential cutover after replacement 12-hex/scrypt
-- credentials have been created, securely distributed, and validated.
--
-- Revoke only active legacy credentials. New credentials created during the
-- schema-21 staging window remain active.

begin;

update public.game_api_credentials
set revoked_at = now()
where revoked_at is null
  and key_prefix ~ '^sk_(test|live)_[a-zA-Z0-9]{8}$';

-- Fail closed if a legacy credential somehow remains active after the update.
do $$
begin
  if exists (
    select 1
    from public.game_api_credentials
    where revoked_at is null
      and key_prefix ~ '^sk_(test|live)_[a-zA-Z0-9]{8}$'
  ) then
    raise exception 'active legacy game API credentials remain after schema 22 cutover';
  end if;
end $$;

update public.schema_release_state
set version = 22,
    updated_at = now()
where id = 1;

commit;
