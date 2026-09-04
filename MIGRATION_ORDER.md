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
20. `supabase/19_public_match_graph_privacy.sql`
21. `supabase/20_disable_public_match_realtime.sql`
22. `supabase/21_rotate_game_api_key_hashes.sql`
23. `supabase/22_revoke_legacy_game_api_keys.sql`
24. `NOTIFY pgrst, 'reload schema';`

The latest hosted schema marker after the complete cutover chain is `22` in `public.schema_release_state`.

## Two-Phase Integration Credential Cutover

Credential rotation is deliberately split so schema work does not unnecessarily interrupt active studio integrations:

1. Apply migrations through **schema 21**. Migration 21 is non-destructive: it permits both legacy 8-character prefixes and new 12-hex prefixes, and adds unique prefix lookup. It does **not** revoke active credentials.
2. While the legacy application/integrations are still available, create the replacement scrypt credentials in a controlled environment and securely distribute them to each studio. Validate that each replacement credential is recorded and ready for the new application cutover.
3. During the coordinated application cutover, apply **schema 22**. Migration 22 revokes only active legacy 8-character-prefix credentials and asserts that no active legacy credential remains.
4. Promote the scrypt-only application and switch integrations to the pre-staged replacement credentials.

Do not apply schema 22 before replacement credentials have been staged and the cutover is coordinated.

## Release Gate

A production release is not ready until all of the following are true:

- every hosted migration above has succeeded through schema 22;
- `public.schema_release_state.version = 22`;
- service-role access to `guilds` succeeds;
- public profile access is column-scoped and does not expose email, Privy IDs, login timestamps, earnings, or private wallet fields;
- anonymous/authenticated clients cannot enumerate `challenges`, `challenge_participants`, or `match_participants` directly;
- direct public match access is column-scoped to the live/public UI projection and does not expose challenge linkage or free-form context columns;
- `public.matches` is not present in the `supabase_realtime` publication; live/public clients use explicit safe projections and polling instead;
- replacement integration credentials use 12-hex prefixes with scrypt-derived secret hashes;
- no active legacy 8-character-prefix integration credential remains after schema 22;
- `HTTP Validation %` fixture games are not active;
- settlement RPCs (`claim_match_settlement`, `record_match_settlement_tx`, `release_match_settlement_lease`) are available only to `service_role`;
- PostgREST schema cache has been reloaded;
- `/api/health` reports `status: ok` against the target deployment.

Vercel deployment status alone is not a database migration signal.

## Hosted Safety Notes

Do not run `01_initial_schema.sql` in hosted Supabase. It contains local compatibility objects for the managed `auth` schema. Use `01_initial_schema_hosted_supabase.sql` instead.

All application mutations that require elevated database privileges are performed by server routes using `service_role`. Sensitive tables, including integration credentials, result submissions, risk reservations, API rate-limit buckets, settlement leases, challenge participant link tables, and release schema state, must remain inaccessible to `anon` and `authenticated` roles except where a migration explicitly grants a public-safe projection.
