# SkillFi Arena TODO

Tasks are ordered by current production priority. Complexity: S, M, L, XL.

## 1. Correct Supabase Development Service Role

- Status: Completed on 2026-08-26. The local URL is normalized to one valid assignment and the hosted validation accepts the configured server-only service-role credential.

- Description: Replace the publishable key currently configured as `SUPABASE_SERVICE_ROLE_KEY` with a true development service-role secret or legacy `service_role` JWT. Do not commit the value. Also remove the duplicate `NEXT_PUBLIC_SUPABASE_URL` assignment from local `.env.local` while preserving the correct hosted project URL.
- Affected files: local `.env.local` only, `SUPABASE_API_VALIDATION_REPORT.md`, `SUPABASE_DEV_SETUP.md`
- Estimated complexity: M
- Dependencies: Development Supabase dashboard access
- Acceptance criteria: `SUPABASE_SERVICE_ROLE_KEY` is not a publishable key, `npm run test:supabase` can seed the deterministic game fixture through the server-side Supabase client without RLS failure, and no credentials are committed.

## 2. Run Supabase API Integration Tests

- Status: Completed on 2026-08-26. Profile sync, challenge acceptance, canonical match creation, and ten two-player acceptance races passed against the hosted development project.

- Description: Run the completed player sync, challenge creation, invitation, and acceptance flow through real `/api/*` routes against the hosted Supabase development project.
- Affected files: `tests/`, `scripts/supabase-http-validation.mjs`, `app/api/auth/sync/route.ts`, `app/api/matches/create/route.ts`, `app/api/challenges/[id]/accept/route.ts`, `lib/privy.ts`
- Estimated complexity: M
- Dependencies: Task 1; `public.accept_challenge` visible only to the intended service-role route path; valid development service-role credential configured server-side only
- Acceptance criteria: Player A syncs, creates a challenge, Player B syncs and accepts, one match exists, two participants exist, lobby returns accepted state, and no credentials appear in logs.

## 3. Verify Supabase PostgREST Grants

- Status: Completed on 2026-08-26. Public lobby reads pass while private challenge hashes, anonymous RPC execution, direct match/participant inserts, and direct challenge updates are rejected.

- Description: Confirm anon/authenticated Supabase clients can read only safe public challenge columns and cannot read `invitation_token_hash` or other server-only fields.
- Affected files: `03_two_player_challenge_flow.sql`, `app/page.tsx`, `components/LobbyClient.tsx`, `app/challenge/[token]/page.tsx`, `scripts/supabase-http-validation.mjs`
- Estimated complexity: M
- Dependencies: Tasks 1-2
- Acceptance criteria: PostgREST rejects private columns; lobby and invitation pages still load using explicit safe selects; `accept_challenge` is not executable through anon/authenticated publishable-key clients.

## 4. Build Match Detail Screen

- Status: Completed on 2026-08-27. Accepted invitations now link to a canonical `/matches/[id]` page showing both participants, lifecycle status, stake, rules, and identifiers without exposing escrow or settlement actions.

- Description: Add a canonical match detail page for accepted challenges showing both players and current lifecycle state.
- Affected files: new `app/matches/[id]/page.tsx`, new/updated components, `lib/types.ts`
- Estimated complexity: M
- Dependencies: Tasks 1-3
- Acceptance criteria: Accepted challenge links to match detail; both participants are shown; no escrow/result/payout actions are exposed yet.

## 5. Align Deposit Sprint With SkillFiEscrowV2

- Status: Completed on 2026-08-27. The deployed Base Sepolia escrow was exercised through create, approve, two deposits, operator start, result submission, settlement, payout, and zero-balance escrow verification; DB reconciliation and retry handling were hardened during the live test.

- Description: Design and implement the next sprint's USDC approval/deposit flow around the existing operator-created `SkillFiEscrowV2` model.
- Affected files: `web3/contracts/SkillFiEscrowV2.sol`, `lib/abi/skillFiEscrow.ts`, `lib/contracts.ts`, challenge/match UI, new API routes
- Estimated complexity: XL
- Dependencies: Tasks 1-4
- Acceptance criteria: ABI matches deployed contract; deposits are verified server-side; DB and contract status transitions stay consistent; Web3 tests remain at or above 48.

## 6. Add Transaction And Audit Records

- Status: Completed on 2026-08-27. Hosted Supabase now stores immutable, idempotent match lifecycle events; mutation and duplicate-key checks pass, existing matches were backfilled with snapshots, and authenticated users can view their related transaction trail from Profile.

- Description: Persist lifecycle events, actor IDs, transaction hashes, and operational decisions before money movement.
- Affected files: new migration, API routes, `lib/types.ts`, future account/admin screens
- Estimated complexity: L
- Dependencies: Task 5 design
- Acceptance criteria: Every financial or lifecycle action has an immutable audit row; retries are idempotent; users can see relevant own history.

## 7. Enforce Risk Controls Before Stakes

- Status: Completed on 2026-08-27. Hosted Supabase now reserves stake atomically before wallet signatures, enforces restricted-account and daily stake/loss limits, keeps risk data service-role-only, and passes live boundary/idempotency checks.

- Description: Read and enforce user risk profiles before any deposit or stake-bearing action.
- Affected files: `lib/auth/server.ts`, new risk services/routes, future deposit routes, migrations
- Estimated complexity: L
- Dependencies: Tasks 5-6
- Acceptance criteria: Daily stake/loss limits are enforced server-side; private risk data never appears in public reads; tests cover boundaries.

## 8. Implement Settlement And Payout

- Status: Completed on 2026-08-27. Settlement now validates DB and on-chain participants before the operator signs, records broadcast and confirmed payout state, tolerates concurrent/repeated reconciliation, exposes a participant-authorized recovery route, and passes live transaction/audit reconciliation against Base Sepolia.

- Description: Add result submission, operator/arbiter verification, escrow settlement, and payout recording.
- Affected files: settlement API routes, match UI, `lib/abi/skillFiEscrow.ts`, audit tables, operator tooling
- Estimated complexity: XL
- Dependencies: Tasks 5-7
- Acceptance criteria: Winner must be a participant; unauthorized settlement is rejected; on-chain payout and DB completion are recoverable and audited.

## 9. Implement Cancellation And Refund Reconciliation

- Status: Completed on 2026-08-28. Creator-authorized pre-start cancellation, on-chain refund reconciliation, risk-reservation release, and multi-recipient transaction identity are implemented. A disposable unfunded match was cancelled on Base Sepolia and reconciled to hosted Supabase; the 48-test contract suite verifies exact one- and two-depositor refunds, replay protection, and terminal-state invariants.

- Description: Let a challenge creator safely cancel an unstarted match and reconcile every on-chain refund into the database and audit trail.
- Affected files: cancellation API, escrow ABI, risk service, transaction migration, product tests
- Estimated complexity: L
- Dependencies: Tasks 6-8
- Acceptance criteria: Started matches cannot be cancelled; only the creator can request cancellation; every deposited participant receives an idempotent refund record; reservations are released; retries are safe.

## 10. Implement Participant Disputes

- Status: In progress on 2026-08-28. Participant wallet submission, validated dispute reasons, receipt/event verification, immutable audit recording, automatic-settlement pause UI, hosted schema migration, participant status visibility, and role-verified arbiter tooling are implemented. The operator can list pending disputes, and resolution safely recovers when the chain transaction succeeded before database reconciliation; a live two-player dispute and arbitration exercise remains.

- Description: Allow either participant to stop automatic settlement when a live result is contested, while keeping arbitration separate and privileged.
- Affected files: live match UI, dispute API, escrow ABI, match status migration, product tests
- Estimated complexity: L
- Dependencies: Tasks 6-9
- Acceptance criteria: Only an on-chain participant can dispute an active match; the exact escrow event is verified; disputed matches cannot auto-settle; the action is audited; only an arbiter can resolve the dispute.

## 11. Studio & Game Onboarding

- Status: In progress on 2026-08-28. Studio ownership, private application records, game drafts, a studio portal, separate testnet USDC listing-fee verification, administrator review, immutable audit events, hashed/scoped/revocable API credentials, and an HMAC-signed idempotent game-server result protocol are implemented locally; the hosted migration and live fee/result exercises remain.
- Description: Let studios register, submit games, pay a configurable integration fee, and progress through technical review without mixing studio revenue with player escrow.
- Affected files: studio migration, studio APIs and portal, game catalog policies, payment verification, future admin and developer integration surfaces
- Estimated complexity: XL
- Dependencies: Stable player identity, hosted Supabase access, configured testnet treasury
- Acceptance criteria: Only the owner controls a studio; drafts are not public; one fee transaction cannot be reused; the exact token, sender, treasury, amount, and chain receipt are verified; administrators approve publication; approved games receive scoped integration credentials.
