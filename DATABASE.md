# Database

Final shared challenge migration: `03_two_player_challenge_flow.sql`.

SkillFi Arena keeps one application schema model, with two migration entry paths:

- Local/embedded validation path for the original compatibility baseline.
- Hosted Supabase SQL Editor path that avoids managed `auth` schema ownership.

See `MIGRATION_ORDER.md` for exact execution order.

## Local / Embedded Migration Chain

Use this chain for `npm run test:db`:

1. `01_initial_schema.sql`
2. `02_privy_identity_migration.sql`
3. `03_two_player_challenge_flow.sql`

The local baseline includes compatibility objects for embedded PostgreSQL validation, including `auth.users`, an `auth.uid()` helper when absent, and the original auth provisioning trigger expected before migration 02.

## Hosted Supabase Migration Chain

Use this chain in hosted Supabase SQL Editor:

1. `01_initial_schema_hosted_supabase.sql`
2. `02_privy_identity_migration_hosted_supabase.sql`
3. `03_two_player_challenge_flow.sql`
4. `NOTIFY pgrst, 'reload schema';`

The hosted baseline owns only application objects in `public`. It does not create, replace, or attach triggers to hosted Supabase-managed `auth` objects.

## Baseline Public Objects

Both baseline paths create the application-owned public tables required before migration 03:

- `public.users`
- `public.games`
- `public.matches`
- `public.user_risk_profiles`
- `public.transactions`

The schema uses UUID primary keys where expected by application code. Token amounts use `numeric(78,0)` base units so 6-decimal USDC values remain integer-like at the database boundary.

## Challenge Migration Objects

`03_two_player_challenge_flow.sql` adds or modifies:

- `public.users`: profile display fields, email, primary wallet, stats, earnings, last login.
- `public.challenges`: off-chain challenge records with hashed invitation token.
- `public.challenge_participants`: challenge creator and accepted participant rows.
- `public.matches`: challenge linkage and off-chain accepted match metadata.
- `public.match_participants`: canonical two-player match participants.
- `public.touch_updated_at()`: update timestamp trigger helper.
- `public.accept_challenge(uuid, uuid)`: atomic acceptance RPC.

## Invitation Storage

`challenges.invitation_token_hash` stores a SHA-256 hash of the raw token. The raw token is only present in the generated URL returned to the creator and in Player B's request URL.

Column-level grants keep `invitation_token_hash` inaccessible to anon and authenticated PostgREST clients after migration 03. Server-side routes use the service role for private challenge acceptance operations.

## RLS And Grants

The migrations enable RLS and public read policies for lobby-visible user, game, match, challenge, and participant state. Writes happen through server routes using the service role. `accept_challenge` execution is granted to `service_role` only.

## Validation

Database validation commands:

```bash
npm run test:db
npm run test:db:hosted
```

Latest required result:

- local/embedded chain: passed
- hosted-safe chain: passed under embedded PostgreSQL public-schema validation
- representative existing-schema migration: passed
- challenge migration rerun: passed
- concurrent challenge acceptance: 10/10 races produced one success and one controlled conflict
- RLS/grant checks: passed

HTTP API validation remains intentionally paused until the hosted-safe migrations are manually applied in the Supabase development project and PostgREST schema cache is reloaded.
