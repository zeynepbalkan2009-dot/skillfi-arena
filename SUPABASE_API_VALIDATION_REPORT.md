# Supabase API Validation Report

## Current Status

Blocked at Supabase HTTP/API validation pre-seed as of 2026-08-25.

The hosted-safe migrations were manually applied in the development Supabase project in this order:

1. `01_initial_schema_hosted_supabase.sql`
2. `02_privy_identity_migration_hosted_supabase.sql`
3. `03_two_player_challenge_flow.sql`
4. `NOTIFY pgrst, 'reload schema';`

Credentials were not printed, logged, or committed during validation.

## Schema / RPC Preflight

Command:

```bash
node scripts/verify-supabase-schema.mjs
```

Result:

- `public.users`: visible
- `public.games`: visible
- `public.matches`: visible
- `public.challenges`: broad `select *` rejected, consistent with private-column grant hardening when using a publishable-key request path
- `public.challenge_participants`: visible
- `public.match_participants`: visible
- `public.accept_challenge` RPC: visible and returned `challenge not found` for a fake challenge id

Security note: the repo migration contains `REVOKE ALL ON FUNCTION public.accept_challenge(uuid, uuid) FROM PUBLIC` and `GRANT EXECUTE ... TO service_role`. Because the preflight request path is currently using a publishable key where the service-role key should be, RPC visibility must be rechecked after the server-only service-role credential is corrected.

## HTTP Validation Attempt

Command:

```bash
npm run test:supabase
```

Result: failed before the HTTP login/profile/challenge flow could begin.

Failure:

```text
Game seed failed: new row violates row-level security policy for table "games"
```

A sanitized credential-shape diagnostic showed that `SUPABASE_SERVICE_ROLE_KEY` is currently configured as a publishable-key class, not a service-role secret or legacy `service_role` JWT. Because of that, the validation runner's server-side Supabase client is evaluated under RLS and cannot seed the deterministic test game fixture.

The local `.env.local` file also contains two `NEXT_PUBLIC_SUPABASE_URL` assignments. The validation helpers normalize this safely by selecting the last usable URL, but the duplicate should be cleaned up when the service-role credential is corrected.

## Not Completed Due To Blocker

The following requested HTTP validations did not run because the seed step failed first:

- complete HTTP login/profile/challenge/invitation/acceptance flow
- 10 parallel HTTP acceptance races
- hosted RLS/PostgREST mutation checks inside the HTTP runner
- lobby refresh validation inside the HTTP runner

## Independent Verification Completed

These checks passed after the hosted HTTP blocker was identified:

- `npm run lint`: passed, no warnings or errors
- `npm run typecheck`: passed
- `npm run test:product`: passed, 7 tests
- `npm run build`: passed
- `npm run test:db`: passed
- `npm run test:db:hosted`: passed after the validation CLI was updated to exit deterministically once the report is written and embedded Postgres is stopped
- `cd web3 && npx hardhat clean && npx hardhat compile`: passed, compiled 2 Solidity files with solc 0.8.28
- `cd web3 && npm run test`: passed, 48 tests

## Required User Action

Replace the development value of `SUPABASE_SERVICE_ROLE_KEY` with a true server-only service-role credential or legacy `service_role` JWT. Do not use a publishable key for this variable.

After updating `.env.local`, rerun:

```bash
node scripts/verify-supabase-schema.mjs
npm run test:supabase
```

The next validation pass should confirm that:

- server-side game seeding bypasses RLS as intended
- `public.accept_challenge` is not executable through anon/authenticated publishable-key clients
- the full HTTP login/profile/challenge/invitation/acceptance flow passes
- 10 parallel HTTP acceptance races produce one success and one controlled conflict each
- lobby refresh validation passes

## Readiness Decision

Not ready to begin escrow deposits, gameplay, settlement, or payout. Supabase HTTP integration remains blocked on the server-only service-role credential class.
