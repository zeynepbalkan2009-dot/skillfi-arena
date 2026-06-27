# SkillFi Arena — Frontend Scaffold

Next.js 14 (App Router) + TypeScript + Tailwind + Wagmi v2/RainbowKit + Supabase.
This is the third piece of a three-part stack:

1. `SkillFiEscrow.sol` — the on-chain escrow contract (`createMatch`, `joinMatch`, `settleMatch`, ...)
2. The Postgres/Supabase schema (`matches`, `users`, `ratings`, RLS policies, `find_match()`)
3. **This app** — the lobby UI and challenge-creation flow

## Setup

```bash
npm install --legacy-peer-deps   # Privy's React SDK pulls in optional Solana
                                  # peers (@solana-program/*, @solana/kit) that
                                  # conflict with unrelated transitive deps in
                                  # this EVM-only app — safe to skip with this
                                  # flag. See package.json for the exact pinned
                                  # versions this was tested against.
cp .env.local.example .env.local   # fill in every value — see comments in that file
npm run dev
```

Run `supabase/02_privy_identity_migration.sql` against your project (after the
original schema script from part 2) before starting the app — it decouples
`public.users` from `auth.users` and adds the `privy_user_id` column this app
now depends on. See the comment block at the top of that file for why.

You'll need: a Supabase project running the schema + migration above, a Privy
app ID + app secret (https://dashboard.privy.io), and the deployed addresses
of `SkillFiEscrow.sol` and the $GNESS ERC20 token (Base Sepolia by default —
see `lib/contracts.ts` to swap to mainnet).

**If `npm run build` fails on `@stripe/crypto`, `@farcaster/mini-app-solana`,
or `@react-native-async-storage/async-storage`:** these are optional Privy
features (Solana, fiat on-ramp, React Native) that this app never uses but
that the bundler tries to resolve anyway. `next.config.mjs` already
externalizes them — if you see this error, check that file wasn't
overwritten.

## Architecture notes that don't fit in a code comment

**Identity is Privy-only — there is no Supabase Auth session anywhere in
this app.** An earlier draft of this integration tried to hand Privy's
access token to the Supabase client directly, on the theory that it would
make `auth.uid()` resolve to the calling user in RLS policies. That doesn't
work: Privy isn't one of Supabase's supported Third-Party Auth providers
(Clerk, Firebase Auth, Auth0, AWS Cognito, WorkOS — Privy isn't on that
list), and a Privy access token's `sub` claim is a Privy DID string (e.g.
`did:privy:cl812utgs...`), not a UUID — `auth.uid()`'s `::uuid` cast on that
throws outright rather than just denying access. So identity resolution
happens entirely server-side instead: `lib/privy.ts` verifies access tokens
with `@privy-io/node`, routes resolve the verified Privy DID to a
`public.users` row by `privy_user_id`, and all privileged reads/writes go
through `service_role` (`lib/supabaseAdmin.ts`). `lib/supabaseClient.ts`'s
anon client is used only for genuinely public reads (profiles, games,
ratings, searching matches) and the realtime subscription — never for
anything gated by who's logged in.

**Account provisioning replaces the old `auth.users` trigger.**
`app/api/auth/sync/route.ts` is called by `components/AuthSync.tsx` whenever
Privy's auth state changes. First-time users get prompted for a
username/region via `components/OnboardingCard.tsx` (Privy doesn't collect
either). The resolved profile is exposed app-wide via `useSkillFiUser()`
(also in `AuthSync.tsx`) — that's the one source of truth for "who's logged
in," used by `LobbyClient.tsx` instead of the wallet-address-lookup pattern
an earlier draft used (which never surfaced the "needs onboarding" state).

**Why challenge creation goes through `/api/matches/create` instead of a
direct Supabase insert from the browser.** Same reasoning as above, plus:
RLS can't verify that a claimed `smart_contract_match_id` corresponds to a
real, confirmed on-chain deposit — only a server with RPC access can. So the
write path is: client deposits on-chain → client hands the tx hash (and its
own verified Privy identity, via the `Authorization` header) to the API
route → the route independently re-fetches the receipt, decodes
`MatchCreated`, resolves the depositor's wallet to a `users` row, and writes
via `service_role`. See the comment block at the top of
`app/api/matches/create/route.ts` for the full reasoning, including why the
inserted status is `searching` rather than the `waiting_on_chain` a literal
reading of the original brief would suggest.

**Next steps that aren't built yet, on purpose:** the `joinMatch` flow (the
"Join" button in `ChallengeCard.tsx` is intentionally disabled — same
approve+transaction shape as creating a challenge), a server route for
reading `user_risk_profiles`/`transactions` (currently nothing reads
these — they're fully locked down to `service_role` after the Privy
migration, by design, but a "my account" page will need its own
verify-then-read route following the same pattern as `auth/sync`), and a
real-time toast when one of your own challenges gets joined.
