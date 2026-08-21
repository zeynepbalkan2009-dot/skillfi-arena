# Supabase Development Setup

## Current Status

Dedicated Supabase development project credentials are configured in `.env.local`. Do not print, copy into logs, or commit those values.

Hosted-safe migration files are now available because hosted Supabase owns and manages the `auth` schema. The original local baseline remains valid for embedded PostgreSQL validation, but it must not be run in hosted Supabase SQL Editor.

Current stop point: apply the hosted-safe migration chain manually in the hosted Supabase development project, then resume Supabase HTTP/API validation in a later sprint.

## Local / Embedded Validation

Run the local compatibility migration chain with:

```powershell
npm run test:db
```

This validates:

```text
01_initial_schema.sql
02_privy_identity_migration.sql
03_two_player_challenge_flow.sql
```

## Hosted-Safe Validation

Run the hosted-safe public-schema validation profile with:

```powershell
npm run test:db:hosted
```

This validates:

```text
01_initial_schema_hosted_supabase.sql
02_privy_identity_migration_hosted_supabase.sql
03_two_player_challenge_flow.sql
```

The hosted-safe profile uses embedded PostgreSQL to validate application-owned public schema objects. Hosted Supabase `auth` permissions are addressed by the hosted-safe SQL files, which do not create or modify managed `auth` objects.

## Hosted Supabase SQL Editor Execution

In the hosted Supabase development project SQL Editor, run each item as a complete batch and wait for success before continuing:

1. `01_initial_schema_hosted_supabase.sql`
2. `02_privy_identity_migration_hosted_supabase.sql`
3. `03_two_player_challenge_flow.sql`
4. `NOTIFY pgrst, 'reload schema';`

Do not run `01_initial_schema.sql` in hosted Supabase SQL Editor. It creates local validation compatibility objects in `auth`, which hosted Supabase owns.

Do not run `02_privy_identity_migration.sql` in hosted Supabase SQL Editor if trigger operations on `auth.users` are denied. Use `02_privy_identity_migration_hosted_supabase.sql` instead.

## Option A: Supabase Local Stack On Windows

Install Docker Desktop if local Supabase services are needed:

```powershell
winget install -e --id Docker.DockerDesktop --source winget --accept-package-agreements --accept-source-agreements
```

After installation:

1. Start Docker Desktop from the Start Menu.
2. Complete any WSL2 installation/reboot prompts.
3. Wait until Docker reports it is running.
4. Verify:

```powershell
docker version
docker compose version
```

Install or run the Supabase CLI:

```powershell
npm exec --yes supabase@latest -- --version
```

Start a local stack if needed:

```powershell
npm exec --yes supabase@latest -- init
npm exec --yes supabase@latest -- start
```

The start command prints local API and database values. Put those into the shell session or `.env.local` only. Never commit them.

## Option B: Dedicated Supabase Development Project

Required values for hosted HTTP/API validation:

- development project URL
- development anon or publishable key
- development service-role key
- project database access only if using CLI migration workflows

Set them only in the shell or `.env.local`, never in committed files.

Make sure the server-only key remains server-only:

```text
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service-role secret or legacy service_role JWT>
```

Do not put a publishable key in `SUPABASE_SERVICE_ROLE_KEY`.

## Next Validation Sprint

After the hosted-safe SQL Editor chain has been applied and PostgREST has reloaded its schema cache, resume the Supabase HTTP/API validation sprint with the existing validation runner. Do not start escrow deposits, gameplay, settlement, or payout work until HTTP validation passes.
