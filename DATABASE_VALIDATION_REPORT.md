# Database Validation Report

## Scope

This report covers database migration validation only. Supabase HTTP/API validation is intentionally paused until the hosted-safe migrations are manually applied in the hosted Supabase development project.

## Migration Files

Local/embedded validation files:

1. `01_initial_schema.sql`
2. `02_privy_identity_migration.sql`
3. `03_two_player_challenge_flow.sql`

Hosted Supabase SQL Editor files:

1. `01_initial_schema_hosted_supabase.sql`
2. `02_privy_identity_migration_hosted_supabase.sql`
3. `03_two_player_challenge_flow.sql`
4. `NOTIFY pgrst, 'reload schema';`

No duplicate migration numbers are present in the active root SQL sequence. The hosted-safe files are environment-specific variants, not parallel application tables or a new product architecture.

## Hosted-Safe Compatibility

`01_initial_schema_hosted_supabase.sql` creates only application-owned `public` schema objects. It does not create the `auth` schema, `auth.users`, `auth.uid()`, or triggers on `auth.users`.

`02_privy_identity_migration_hosted_supabase.sql` avoids trigger operations on `auth.users` while preserving the Privy identity transition required before migration 03.

`03_two_player_challenge_flow.sql` is shared by both validation paths.

## Local / Embedded Validation Result

Command:

```bash
npm run test:db
```

Result: passed.

Validated path:

```text
01_initial_schema.sql -> 02_privy_identity_migration.sql -> 03_two_player_challenge_flow.sql
```

Verified outcomes:

- clean database migration passed
- representative existing-schema migration passed
- rerunning `03_two_player_challenge_flow.sql` passed
- expected public tables, constraints, indexes, triggers, functions, grants, and policies were present
- invitation token hash remained inaccessible to anon/authenticated clients
- service-role-only mutation/RPC model was preserved

## Hosted-Safe Validation Result

Command:

```bash
npm run test:db:hosted
```

Result: passed.

Validated path:

```text
01_initial_schema_hosted_supabase.sql -> 02_privy_identity_migration_hosted_supabase.sql -> 03_two_player_challenge_flow.sql
```

Verified outcomes:

- hosted baseline public schema objects created successfully
- hosted Privy migration completed without touching hosted-managed `auth.users`
- shared challenge migration completed successfully
- representative existing-schema migration passed
- rerunning `03_two_player_challenge_flow.sql` passed
- 10 concurrent challenge acceptance races each produced one success and one controlled conflict
- RLS and grant checks passed

Hosted `auth` schema permission behavior is hosted-specific. The hosted-safe SQL files avoid the denied operations that caused hosted SQL Editor to reject the original local baseline.

## Hosted Supabase SQL Editor Steps

Run these files in the hosted Supabase development project SQL Editor in order, waiting for each batch to succeed:

1. `01_initial_schema_hosted_supabase.sql`
2. `02_privy_identity_migration_hosted_supabase.sql`
3. `03_two_player_challenge_flow.sql`
4. `NOTIFY pgrst, 'reload schema';`

After that manual step, Supabase HTTP/API validation can resume in a separate sprint.

## Broader Verification

Latest requested full verification after documentation update:

- Lint: passed, no warnings or errors.
- Typecheck: passed.
- Product tests: passed, 7 tests.
- Production build: passed.
- Web3 compile: passed, Hardhat reported no contracts to compile.
- Web3 test suite: passed, 48 tests.
