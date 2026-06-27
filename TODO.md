# SkillFi Arena TODO

Tasks are ordered by priority. Complexity estimates: S, M, L, XL.

## P0 - Restore a Buildable, Single Active Codebase

### 1. Reconcile active vs stranded app implementations

- Description: Move the intended newer implementations into the active Next.js paths or deliberately discard them after review. Ensure there is only one active implementation for providers, wallet connect, lobby identity, Supabase client, Wagmi config, Privy utilities, auth sync route, and match create route.
- Affected files: `app/providers.tsx`, `components/LobbyClient.tsx`, `components/WalletConnect.tsx`, `components/SupabaseSync.tsx`, `lib/supabaseClient.ts`, `lib/wagmi.ts`, root `providers.tsx`, root `LobbyClient.tsx`, root `WalletConnect.tsx`, root `AuthSync.tsx`, root `OnboardingCard.tsx`, root `supabaseClient.ts`, root `wagmi.ts`, root `privy.ts`, root `route.ts`, `mnt/user-data/outputs/skillfi-arena/app/api/matches/create/route.ts`
- Estimated complexity: L
- Dependencies: None
- Acceptance criteria: The active app has no duplicate stranded implementation for the same feature; imports resolve from canonical folders; obsolete files are removed or archived intentionally; `npm run build` reaches a clear pass/fail without hanging on missing imports.

### 2. Fix build-breaking imports and dependency mismatches

- Description: Resolve named/default provider export mismatch, `supabase` export mismatch, and missing RainbowKit imports by aligning active code with installed dependencies.
- Affected files: `app/layout.tsx`, `app/providers.tsx`, `components/WalletConnect.tsx`, `lib/supabaseClient.ts`, `lib/wagmi.ts`, `package.json`, `package-lock.json`
- Estimated complexity: M
- Dependencies: Task 1
- Acceptance criteria: TypeScript module resolution succeeds; no active file imports `@rainbow-me/rainbowkit` unless the dependency is intentionally added; `app/layout.tsx` imports the actual provider export; active Supabase imports match exported symbols.

### 3. Establish non-interactive verification scripts

- Description: Configure linting and test scripts so CI/local verification can run without prompts or placeholder failures.
- Affected files: `package.json`, `.eslintrc.*` or equivalent, `web3/package.json`, possible CI config
- Estimated complexity: M
- Dependencies: Task 2
- Acceptance criteria: `npm run lint` exits non-interactively; root has a test command or explicitly documented absence; `web3 npm run test` runs real Hardhat tests or is renamed to avoid a false test script; all verification commands have documented expected outcomes.

## P0 - Secure Identity and Match Creation

### 4. Activate Privy account sync API

- Description: Implement active `/api/auth/sync` using the stranded route as the starting point, verify Privy tokens server-side, provision `public.users`, and create/recover risk profiles idempotently.
- Affected files: `app/api/auth/sync/route.ts`, `lib/privy.ts`, `lib/supabaseAdmin.ts`, `components/AuthSync.tsx`, `components/OnboardingCard.tsx`, `app/providers.tsx`
- Estimated complexity: L
- Dependencies: Tasks 1, 2
- Acceptance criteria: Authenticated Privy user receives existing profile; first-time user receives onboarding-required response; completed onboarding creates user and risk profile; missing risk profile is repaired on later sync; unauthenticated requests return 401.

### 5. Remove Privy-token Supabase browser auth pattern

- Description: Ensure browser Supabase usage is anon-only public reads/realtime, and all authenticated operations go through route handlers.
- Affected files: `lib/supabaseClient.ts`, `components/SupabaseSync.tsx`, `components/LobbyClient.tsx`, `README.md`, `02_privy_identity_migration.sql`
- Estimated complexity: M
- Dependencies: Task 4
- Acceptance criteria: No active code creates a Supabase client with a Privy bearer token; `components/SupabaseSync.tsx` is removed if unused; docs match active behavior.

### 6. Activate verified `/api/matches/create`

- Description: Move/reconcile the stranded verified match route into `app/api/matches/create/route.ts`, require Privy authentication, validate active game, verify transaction receipt, decode escrow event, resolve depositor, and insert idempotently with service role.
- Affected files: `app/api/matches/create/route.ts`, `components/CreateChallengeModal.tsx`, `lib/privy.ts`, `lib/contracts.ts`, `lib/abi/skillFiEscrow.ts`, `lib/supabaseAdmin.ts`
- Estimated complexity: L
- Dependencies: Tasks 4, 5, 8
- Acceptance criteria: Missing/invalid token returns 401; invalid body returns 400; unknown game returns 400; pending/missing tx returns retry-safe error; reverted or wrong-contract tx is rejected; duplicate indexing returns existing match; successful verified tx creates exactly one searching match.

## P0 - Resolve Contract Integration Model

### 7. Choose the escrow contract model for MVP

- Description: Decide whether MVP uses the frontend's player-created `bytes32` deposit model or `SkillFiEscrowV2`'s operator-created `uint256` match model, then document the selected lifecycle.
- Affected files: `contracts/SkillFiEscrowV2.sol`, `lib/abi/skillFiEscrow.ts`, `components/CreateChallengeModal.tsx`, `app/api/matches/create/route.ts`, `README.md`, `CURRENT_ARCHITECTURE.md`
- Estimated complexity: M
- Dependencies: Product/security decision
- Acceptance criteria: One contract interface is declared canonical; frontend ABI, server receipt decoding, database fields, and deployment docs all match it; obsolete contract artifacts are removed or clearly marked non-production.

### 8. Align ABI, frontend calls, and server verification with selected contract

- Description: Update contract ABI and client/server code to use the same function signatures, event types, match ID type, and status semantics.
- Affected files: `lib/abi/skillFiEscrow.ts`, `components/CreateChallengeModal.tsx`, `app/api/matches/create/route.ts`, `lib/types.ts`, `contracts/SkillFiEscrowV2.sol` if selected/changed
- Estimated complexity: L
- Dependencies: Task 7
- Acceptance criteria: Create flow uses the deployed contract's real ABI; receipt decoding matches emitted events; TypeScript types represent on-chain IDs correctly; integration tests cover successful and rejected create flows.

### 9. Add SkillFi escrow contract tests

- Description: Replace/sample-expand Hardhat tests to cover SkillFi escrow behavior instead of Counter scaffold.
- Affected files: `web3/contracts/*` or `contracts/*`, `web3/test/*`, `web3/package.json`, `contracts/SkillFiEscrowV2.sol`
- Estimated complexity: L
- Dependencies: Task 7
- Acceptance criteria: Tests cover create, join, double join prevention, start, resolve, dispute, cancel, expire/refund, fees, pause, and role authorization; tests run through a non-placeholder script.

## P1 - Complete Core MVP Gameplay Lifecycle

### 10. Implement join challenge flow

- Description: Build UI, contract transaction, server verification, and database update for a second player joining an open challenge.
- Affected files: `components/ChallengeCard.tsx`, new/updated join modal or flow component, `app/api/matches/join/route.ts`, `lib/abi/skillFiEscrow.ts`, `lib/types.ts`
- Estimated complexity: XL
- Dependencies: Tasks 4, 5, 7, 8
- Acceptance criteria: Non-owner can join; owner cannot join own challenge; stake amount is enforced; on-chain deposit is verified server-side; `player_b_id` and status update atomically; realtime removes/updates challenge correctly.

### 11. Implement match start lifecycle

- Description: Add server/operator transition from ready/joined match to active/in-progress both on-chain and in Supabase.
- Affected files: new `app/api/matches/start/route.ts`, contract integration files, `lib/types.ts`, UI state components
- Estimated complexity: L
- Dependencies: Task 10
- Acceptance criteria: Only authorized operator path can start a ready match; DB and contract statuses stay consistent; duplicate start is idempotent or safely rejected; UI reflects active state.

### 12. Implement settlement and payout flow

- Description: Add result submission/verification and authorized settlement calling the escrow contract and updating Supabase.
- Affected files: new settlement route(s), contract integration files, `lib/types.ts`, match detail UI, admin/operator tooling
- Estimated complexity: XL
- Dependencies: Tasks 10, 11
- Acceptance criteria: Winner is validated as participant; unauthorized settlement is rejected; on-chain payout succeeds before final DB completion; transaction hash/audit record is stored; failure states are recoverable.

### 13. Implement cancellation, expiry, and refunds

- Description: Add user/operator flows and background reconciliation for cancelled or expired matches.
- Affected files: new cancel/expire route(s), UI actions, contract integration files, possible scheduler/background job
- Estimated complexity: L
- Dependencies: Tasks 7, 8, 10
- Acceptance criteria: Eligible matches can be cancelled/refunded; expired matches can be refunded; DB statuses match chain state; users see clear status and transaction result.

## P1 - Account, Risk, and Audit Controls

### 14. Enforce risk profiles before accepting stakes

- Description: Read and enforce user risk limits server-side before allowing create/join indexing or operator match creation.
- Affected files: `app/api/matches/create/route.ts`, future `app/api/matches/join/route.ts`, new risk profile route, `lib/types.ts`, Supabase schema/migrations
- Estimated complexity: L
- Dependencies: Tasks 4, 6, 10
- Acceptance criteria: Daily loss/stake limits are checked server-side; rejected attempts happen before irreversible user action where possible; risk profile reads are private; tests cover limit boundaries.

### 15. Add transaction/audit records

- Description: Persist on-chain tx hashes, lifecycle transitions, actor IDs, and settlement decisions for support and compliance.
- Affected files: Supabase migration(s), create/join/start/settle/cancel routes, types, account/history UI
- Estimated complexity: L
- Dependencies: Tasks 6, 10, 12
- Acceptance criteria: Every financial/lifecycle action writes an audit record; records are queryable by user/admin route; duplicate webhook/retry events do not duplicate audit entries.

### 16. Add profile/account page

- Description: Build authenticated account UI for profile, linked wallet, risk profile, and transaction history.
- Affected files: new `app/account/page.tsx`, account components, authenticated account routes, `lib/types.ts`
- Estimated complexity: M
- Dependencies: Tasks 4, 14, 15
- Acceptance criteria: User can view own profile, wallet, risk settings, and transaction history; no user can read another user's private risk/transaction data.

## P1 - Deployment and Operational Readiness

### 17. Clean generated artifacts and repo hygiene

- Description: Remove committed build/generated outputs and clarify workspace boundaries.
- Affected files: `.next`, `web3/artifacts`, `web3/cache`, `web3/types`, `.gitignore`, `web3/.gitignore`, docs
- Estimated complexity: M
- Dependencies: Verification scripts from Task 3
- Acceptance criteria: Generated outputs are not tracked; build/test regenerates needed artifacts; repository tree clearly separates source from generated files.

### 18. Consolidate contract workspace

- Description: Decide whether `contracts/` or `web3/` is the canonical smart contract workspace and migrate SkillFi contracts/tests/deployments there.
- Affected files: `contracts/*`, `web3/*`, package files, deployment docs
- Estimated complexity: L
- Dependencies: Task 7
- Acceptance criteria: One documented command compiles/tests/deploys SkillFi contracts; Counter scaffold is removed; package dependencies match selected Hardhat version.

### 19. Add CI pipeline

- Description: Add automated checks for install, lint, typecheck/build, unit tests, and contract tests.
- Affected files: CI workflow files, `package.json`, `web3/package.json`
- Estimated complexity: M
- Dependencies: Tasks 2, 3, 9
- Acceptance criteria: CI runs on pull requests; failures block merge; local commands match CI commands.

### 20. Add production logging and monitoring

- Description: Replace ad hoc console-only diagnostics with structured route logs and error reporting.
- Affected files: route handlers, server utilities, deployment config
- Estimated complexity: M
- Dependencies: Core route stabilization
- Acceptance criteria: Auth failures, tx verification failures, DB writes, and settlement actions produce structured logs without leaking secrets; production error monitoring captures route exceptions.

## P2 - UX and Growth Features

### 21. Improve lobby UX and responsive behavior

- Description: Add mobile-safe challenge cards, loading states, error states, empty states, and realtime notifications.
- Affected files: `components/LobbyClient.tsx`, `components/ChallengeCard.tsx`, `app/globals.css`
- Estimated complexity: M
- Dependencies: Tasks 1, 10
- Acceptance criteria: Lobby is usable on mobile and desktop; realtime creates/joins trigger visible updates; long names/stakes do not break layout.

### 22. Add game/rating/matchmaking support

- Description: Integrate ratings and optional `find_match()` flow referenced by README/schema intent.
- Affected files: Supabase schema/migrations, lobby UI, match creation/joining routes, `lib/types.ts`
- Estimated complexity: L
- Dependencies: Core lifecycle tasks
- Acceptance criteria: Ratings are loaded/displayed where relevant; matchmaking respects game, region, stake, and status constraints; tests cover matching edge cases.

### 23. Add admin/operator dashboard

- Description: Build a protected interface for operations: match review, start/settle/cancel, disputes, and audit logs.
- Affected files: new admin routes/pages/components, auth/authorization utilities, route handlers
- Estimated complexity: XL
- Dependencies: Tasks 11, 12, 13, 15
- Acceptance criteria: Only authorized operators can access; sensitive actions require confirmation; all actions are audited; dashboard reflects current DB/chain state.

