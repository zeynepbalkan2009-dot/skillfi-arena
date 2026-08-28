# Supabase API Validation Report

## Current Status

Passed against the hosted Supabase development project on 2026-08-26.

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

Security note: the repo migration contains `REVOKE ALL ON FUNCTION public.accept_challenge(uuid, uuid) FROM PUBLIC` and `GRANT EXECUTE ... TO service_role`. The hosted validation confirmed that the configured service-role path can execute the RPC while the anonymous publishable-key path is rejected.

## HTTP Validation Result

Command:

```bash
npm run test:supabase
```

Result: passed. Credentials remained server-only and were redacted from the generated report.

- Player A, B, and C profile sync returned HTTP 200.
- Player B accepted the seeded challenge and the database reached `accepted` with one match and two participants.
- Ten parallel Player B/Player C acceptance races each produced one success and one controlled conflict.
- The public lobby PostgREST read path remained readable.
- Private invitation hashes, anonymous `accept_challenge` RPC execution, direct match/participant inserts, and direct challenge updates were rejected.

## Remaining Scope

- Browser rendering and realtime delivery are separate UI checks; the validation runner verifies the lobby's public PostgREST query rather than waiting for the known slow first development compilation of `/`.
- Escrow/operator validation is skipped until the USDC address, RPC URL, operator wallet, and operator private key are configured.

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

## Re-run

```bash
node scripts/verify-supabase-schema.mjs
npm run test:supabase
```

## Readiness Decision

Supabase HTTP integration and PostgREST grant validation are ready. Escrow deposits, gameplay settlement, and payout validation remain blocked on the missing development escrow/operator configuration and should not be treated as verified yet.
