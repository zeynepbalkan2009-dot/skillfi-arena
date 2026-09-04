# Migration Order

SkillFi Arena has a local compatibility chain and one canonical hosted Supabase release chain.

## Local / Embedded Validation

Use only for local database validation:

1. `01_initial_schema.sql`
2. `02_privy_identity_migration.sql`
3. `03_two_player_challenge_flow.sql`

Run with `npm run test:db`.

## Canonical Hosted Supabase Release Chain

Apply these files in this exact order. Do not stop at the original three-file baseline.

1. `01_initial_schema_hosted_supabase.sql`
2. `02_privy_identity_migration_hosted_supabase.sql`
3. `03_two_player_challenge_flow.sql`
4. `supabase/03_live_matches.sql`
5. `supabase/04_match_audit_events.sql`
6. `supabase/05_risk_stake_reservations.sql`
7. `supabase/06_transaction_event_identity.sql`
8. `supabase/07_match_disputes.sql`
9. `supabase/08_studio_game_onboarding.sql`
10. `supabase/09_guild_dao.sql`
11. `supabase/10_pilot_games.sql`
12. `supabase/11_beta_pilot.sql`
13. `supabase/12_pilot_game_runs.sql`
14. `supabase/13_public_profile_privacy.sql`
15. `supabase/14_risk_idempotency_hardening.sql`
16. `supabase/15_release_schema_state.sql`
17. `supabase/16_api_rate_limits.sql`
18. `supabase/17_disable_test_fixture_games.sql`
19. `supabase/18_settlement_single_writer.sql`
20. `NOTIFY pgrst, 'reload schema';`

The latest hosted schema marker after this chain is `18` in `public.schema_release_state`.

## Release Gate

A production release is not ready until all of the following are true:

- every hosted migration above has succeeded;
- `public.schema_release_state.version = 18`;
- service-role access to `guilds` succeeds;
- public profile access is column-scoped and does not expose email, Privy IDs, login timestamps, earnings, or private wallet fields;
- `HTTP Validation %` fixture games are not active;
- settlement RPCs (`claim_match_settlement`, `record_match_settlement_tx`, `release_match_settlement_lease`) are available only to `service_role`;
- PostgREST schema cache has been reloaded;
- `/api/health` reports `status: ok` against the target deployment.

Vercel deployment status alone is not a database migration signal.

## Hosted Safety Notes

Do not run `01_initial_schema.sql` in hosted Supabase. It contains local compatibility objects for the managed `auth` schema. Use `01_initial_schema_hosted_supabase.sql` instead.

All application mutations that require elevated database privileges are performed by server routes using `service_role`. Sensitive tables, including integration credentials, result submissions, risk reservations, API rate-limit buckets, settlement leases, and release schema state, must remain inaccessible to `anon` and `authenticated` roles except where a migration explicitly grants a public-safe projection.
