# SkillFi Arena TODO

Tasks are ordered by current production priority. Complexity: S, M, L, XL.

## 1. Correct Supabase Development Service Role

- Description: Replace the publishable key currently configured as `SUPABASE_SERVICE_ROLE_KEY` with a true development service-role secret or legacy `service_role` JWT. Do not commit the value. Also remove the duplicate `NEXT_PUBLIC_SUPABASE_URL` assignment from local `.env.local` while preserving the correct hosted project URL.
- Affected files: local `.env.local` only, `SUPABASE_API_VALIDATION_REPORT.md`, `SUPABASE_DEV_SETUP.md`
- Estimated complexity: M
- Dependencies: Development Supabase dashboard access
- Acceptance criteria: `SUPABASE_SERVICE_ROLE_KEY` is not a publishable key, `npm run test:supabase` can seed the deterministic game fixture through the server-side Supabase client without RLS failure, and no credentials are committed.

## 2. Run Supabase API Integration Tests

- Description: Run the completed player sync, challenge creation, invitation, and acceptance flow through real `/api/*` routes against the hosted Supabase development project.
- Affected files: `tests/`, `scripts/supabase-http-validation.mjs`, `app/api/auth/sync/route.ts`, `app/api/matches/create/route.ts`, `app/api/challenges/[id]/accept/route.ts`, `lib/privy.ts`
- Estimated complexity: M
- Dependencies: Task 1; `public.accept_challenge` visible only to the intended service-role route path; valid development service-role credential configured server-side only
- Acceptance criteria: Player A syncs, creates a challenge, Player B syncs and accepts, one match exists, two participants exist, lobby returns accepted state, and no credentials appear in logs.

## 3. Verify Supabase PostgREST Grants

- Description: Confirm anon/authenticated Supabase clients can read only safe public challenge columns and cannot read `invitation_token_hash` or other server-only fields.
- Affected files: `03_two_player_challenge_flow.sql`, `app/page.tsx`, `components/LobbyClient.tsx`, `app/challenge/[token]/page.tsx`, `scripts/supabase-http-validation.mjs`
- Estimated complexity: M
- Dependencies: Tasks 1-2
- Acceptance criteria: PostgREST rejects private columns; lobby and invitation pages still load using explicit safe selects; `accept_challenge` is not executable through anon/authenticated publishable-key clients.

## 4. Build Match Detail Screen

- Description: Add a canonical match detail page for accepted challenges showing both players and current lifecycle state.
- Affected files: new `app/matches/[id]/page.tsx`, new/updated components, `lib/types.ts`
- Estimated complexity: M
- Dependencies: Tasks 1-3
- Acceptance criteria: Accepted challenge links to match detail; both participants are shown; no escrow/result/payout actions are exposed yet.

## 5. Align Deposit Sprint With SkillFiEscrowV2

- Description: Design and implement the next sprint's USDC approval/deposit flow around the existing operator-created `SkillFiEscrowV2` model.
- Affected files: `web3/contracts/SkillFiEscrowV2.sol`, `lib/abi/skillFiEscrow.ts`, `lib/contracts.ts`, challenge/match UI, new API routes
- Estimated complexity: XL
- Dependencies: Tasks 1-4
- Acceptance criteria: ABI matches deployed contract; deposits are verified server-side; DB and contract status transitions stay consistent; Web3 tests remain at or above 48.

## 6. Add Transaction And Audit Records

- Description: Persist lifecycle events, actor IDs, transaction hashes, and operational decisions before money movement.
- Affected files: new migration, API routes, `lib/types.ts`, future account/admin screens
- Estimated complexity: L
- Dependencies: Task 5 design
- Acceptance criteria: Every financial or lifecycle action has an immutable audit row; retries are idempotent; users can see relevant own history.

## 7. Enforce Risk Controls Before Stakes

- Description: Read and enforce user risk profiles before any deposit or stake-bearing action.
- Affected files: `lib/auth/server.ts`, new risk services/routes, future deposit routes, migrations
- Estimated complexity: L
- Dependencies: Tasks 5-6
- Acceptance criteria: Daily stake/loss limits are enforced server-side; private risk data never appears in public reads; tests cover boundaries.

## 8. Implement Settlement And Payout

- Description: Add result submission, operator/arbiter verification, escrow settlement, and payout recording.
- Affected files: settlement API routes, match UI, `lib/abi/skillFiEscrow.ts`, audit tables, operator tooling
- Estimated complexity: XL
- Dependencies: Tasks 5-7
- Acceptance criteria: Winner must be a participant; unauthorized settlement is rejected; on-chain payout and DB completion are recoverable and audited.
