# Database

SkillFi Arena uses a local compatibility chain for embedded validation and a canonical hosted Supabase chain for deployed environments. See `MIGRATION_ORDER.md` for the exact hosted execution order through `supabase/18_settlement_single_writer.sql`.

## Hosted Release State

Hosted deployments must contain `public.schema_release_state` with `version = 18`. `/api/health` treats a missing or older marker as degraded and returns HTTP 503.

The release marker is not a substitute for migrations; it is written by the migration chain and exists so application readiness can detect schema drift.

## Identity And Public Profiles

`public.users` stores both public profile data and private identity/account fields. Anonymous and authenticated PostgREST clients do not have table-wide SELECT access.

Public access is limited to:

- `id`
- `username`
- `display_name`
- `avatar_url`
- `region`
- `wins`
- `losses`
- `matches_played`
- `elo_rating`
- `created_at`

The `public.public_profiles` view exposes the same public-safe projection.

Do not grant public access to `email`, `privy_user_id`, `last_login_at`, `wallet_address`, `primary_wallet_address`, or `total_earnings` without a separate security review.

## Server-Only Tables

The following security-sensitive tables are service-role only:

- `user_risk_profiles`
- `transactions` write paths
- `risk_stake_reservations`
- `match_submissions`
- `match_audit_events` write paths
- `studios` write paths
- `studio_fee_payments`
- `studio_audit_events`
- `game_api_credentials`
- `game_result_submissions`
- `api_rate_limits`
- `match_settlement_leases`
- `schema_release_state`

Settlement coordination RPCs (`claim_match_settlement`, `record_match_settlement_tx`, and `release_match_settlement_lease`) are service-role only. They enforce a database single-writer lease so concurrent serverless invocations cannot independently broadcast settlement transactions for the same match.

Game integration secrets are stored as hashes; raw integration keys are returned once at creation time.

## Challenge And Match Security

Invitation tokens are stored as SHA-256 hashes. Challenge acceptance mutations run through service-role-only server/RPC paths. Public match and challenge feeds must expose only public-safe player fields and must not return private wallet or identity data.

Staked match creation uses risk reservations and idempotency keys. Reusing a finalized or already-attached reservation is rejected. API rate-limit buckets provide serverless-safe fixed-window throttling for sensitive routes.

## Production Fixtures

`supabase/17_disable_test_fixture_games.sql` suspends games whose names begin with `HTTP Validation `. Test fixtures must not appear as active production catalog entries.

## Validation

Required release validation includes:

```bash
npm run test:db
npm run test:db:hosted
npm run typecheck
npm run test:product
npm run build
```

Smart-contract changes also require the Hardhat test suite. Production promotion additionally requires `/api/health` to return `status: ok` after hosted migrations through schema 18 and contract/operator configuration are applied.
