# Migration Order

SkillFi Arena now has two validated migration chains:

- Local/embedded PostgreSQL validation uses the original compatibility chain.
- Hosted Supabase SQL Editor execution uses hosted-safe variants that do not require permissions in the managed `auth` schema.

No migration number conflicts are present.

## Local / Embedded Validation Order

Run this order only for local embedded PostgreSQL validation and other non-hosted environments where the validation harness owns the compatibility `auth` schema:

1. `01_initial_schema.sql`
2. `02_privy_identity_migration.sql`
3. `03_two_player_challenge_flow.sql`

`npm run test:db` validates this order.

## Hosted Supabase SQL Editor Order

Run this exact order in the hosted Supabase development project SQL Editor:

1. Open `01_initial_schema_hosted_supabase.sql`, paste the entire file, and run it as one batch.
2. Wait for success before continuing.
3. Open `02_privy_identity_migration_hosted_supabase.sql`, paste the entire file, and run it as one batch.
4. Wait for success before continuing.
5. Open `03_two_player_challenge_flow.sql`, paste the entire file, and run it as one batch.
6. Wait for success before continuing.
7. Run this cache refresh statement as its own batch:

```sql
NOTIFY pgrst, 'reload schema';
```

Short form:

```text
01_initial_schema_hosted_supabase.sql
02_privy_identity_migration_hosted_supabase.sql
03_two_player_challenge_flow.sql
NOTIFY pgrst, 'reload schema';
```

Do not run the original `01_initial_schema.sql` in hosted Supabase SQL Editor. It creates local-validation compatibility objects in the managed `auth` schema, which hosted Supabase owns.

## Local Compatibility Baseline

`01_initial_schema.sql` creates the original embedded/local baseline expected by migration 02:

- `auth.users`
- `public.users`
- `public.games`
- `public.matches`
- `public.user_risk_profiles`
- `public.transactions`
- `auth.uid()` compatibility helper when absent
- `public.handle_new_user()`
- `trg_handle_new_user` on `auth.users`
- public timestamp triggers
- baseline constraints, indexes, grants, and RLS policies

`public.users.id` initially references `auth.users(id)` so `02_privy_identity_migration.sql` can detach the app identity model from Supabase Auth with:

```sql
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
```

## Hosted-Safe Baseline

`01_initial_schema_hosted_supabase.sql` creates only application-owned public schema objects:

- `public.users`
- `public.games`
- `public.matches`
- `public.user_risk_profiles`
- `public.transactions`
- `public.touch_updated_at()`
- public timestamp triggers
- primary keys, foreign keys, unique constraints, indexes, grants, and baseline RLS policies

It intentionally does not create or modify:

- `auth` schema
- `auth.users`
- `auth.uid()`
- triggers on `auth.users`

`02_privy_identity_migration_hosted_supabase.sql` keeps the Privy identity migration compatible with hosted Supabase by avoiding trigger operations on `auth.users`. It still adds `privy_user_id`, sets the UUID default for `public.users.id`, removes legacy auth-owner policies, and preserves the service-role server route model expected by migration 03.

## Final Challenge Migration

`03_two_player_challenge_flow.sql` is shared by both migration chains. It adds:

- `public.challenges`
- `public.challenge_participants`
- challenge linkage and accepted-match metadata on `public.matches`
- `public.match_participants`
- `public.accept_challenge(uuid, uuid)`
- invitation token hashing protections
- service-role-only mutation/RPC access

## Validation Status

Latest required validation:

- `npm run test:db`: passed for the local/embedded chain.
- `npm run test:db:hosted`: passed for the hosted-safe chain under embedded PostgreSQL, validating public schema compatibility. Hosted `auth` permission behavior is hosted-specific and is addressed by using the hosted-safe SQL files in SQL Editor.
