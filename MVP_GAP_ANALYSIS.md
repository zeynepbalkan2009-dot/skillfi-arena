# MVP Gap Analysis

## Current MVP Readiness

The repository is not yet a production-quality MVP. It has meaningful pieces of a Web3 esports platform, but the active application is not currently integrated end-to-end:

- Active Next.js imports are build-breaking.
- Authentication architecture is split between active old code and stranded newer code.
- Challenge creation posts to a missing API route.
- Frontend contract ABI does not match `SkillFiEscrowV2`.
- Join, match lifecycle, settlement, dispute, account pages, and risk controls are not implemented end-to-end.
- Verification scripts do not provide a passing CI baseline.

## Product Capability Matrix

| Capability | Current Status | Gap |
| --- | --- | --- |
| Public lobby | Partial | Initial Supabase read and realtime are present, but active Supabase client export mismatch blocks build. |
| Wallet/login | Partial | Active provider uses Privy, active WalletConnect uses missing RainbowKit dependency. |
| User onboarding | Stranded | Root-level `AuthSync` and `OnboardingCard` exist but are not active; API route is not in `app/api`. |
| Account identity security | Partial intent | Migration and stranded code define correct pattern; active code still relies on broken Supabase Auth assumptions. |
| Create challenge | Broken | Client posts to missing `/api/matches/create`; active route is wrong path and insecure. |
| On-chain deposit verification | Stranded | Stronger implementation exists under `mnt/user-data/outputs`, but not active. |
| Join challenge | Not implemented | Join button disabled; no client flow, API route, DB update, or contract integration. |
| Match start | Not implemented | No server/operator flow to start match on-chain or in DB. |
| Result reporting | Not implemented | No score/result submission, oracle/operator integration, anti-cheat evidence, or settlement trigger. |
| Settlement/payout | Contract partial | `SkillFiEscrowV2` has resolve functions, but frontend/backend do not call them. |
| Disputes | Contract partial | Contract supports disputes; app has no UI/API/process. |
| Cancellation/expiry/refund | Contract partial | Contract supports cancellation/expiry; app has no UI/API/scheduler. |
| Risk controls | Schema intent only | Migration references `user_risk_profiles`; no active read/update/enforcement flow. |
| Transaction history | Not implemented | Migration references transactions; no UI/API/indexer. |
| Ratings/matchmaking | Schema intent only | README references ratings and `find_match()`; not present in active app. |
| Admin/operator tooling | Not implemented | No dashboard or route for operator-only lifecycle actions. |
| Observability | Minimal | Console errors only; no structured logging, monitoring, or audit trail. |
| Tests/CI | Missing | No passing lint/test/build baseline. |

## Critical Integration Gaps

### 1. Active Source Does Not Match Intended Source

The README describes a Privy-only, server-verified, service-role architecture. The active folders do not implement it. Newer implementations are present at root level and under `mnt/user-data/outputs`, but are not wired into Next.js.

Impact: build failures, broken auth, broken challenge creation, security regression risk.

### 2. API Routes Are Missing or Misplaced

Expected routes:

- `/api/auth/sync`
- `/api/matches/create`

Current active routes:

- `app/matches/create/route.ts`, which maps to `/matches/create`

Impact: client requests fail at runtime, account provisioning cannot run, challenge indexing cannot run.

### 3. Contract Interface Mismatch

The UI assumes player-created `bytes32` match deposits. `SkillFiEscrowV2` implements operator-created `uint256` matches and player deposits through `joinMatch`.

Impact: even after route fixes, the frontend cannot safely interact with the current SkillFi escrow contract without choosing and enforcing one contract model.

### 4. Missing Verification Baseline

Observed during review:

- `npm run build` hung at `Creating an optimized production build ...`.
- `npm run lint` prompts for initial ESLint setup.
- `web3 npm run test` is a placeholder failure.

Impact: no safe way to prove modifications preserve behavior.

## Production MVP Minimum Required Scope

To call this a production-quality MVP, the platform needs at least:

1. Passing build/lint/test baseline.
2. One active, coherent identity implementation.
3. One active, coherent contract integration model.
4. End-to-end challenge creation with server-side transaction verification.
5. End-to-end challenge joining with escrow deposit verification.
6. Server-controlled match lifecycle transitions.
7. Settlement path with authorization, auditability, and payout verification.
8. Basic cancellation/refund handling.
9. User onboarding and wallet linking.
10. Risk limits enforced before accepting stakes.
11. Transaction/history views or audit records.
12. Deployment-safe env validation and secret boundaries.

## Deferred But Important Post-MVP Scope

- Automated matchmaking.
- Ratings and leaderboards.
- Anti-cheat provider integration.
- Dispute evidence workflow.
- Admin operations dashboard.
- Notifications/toasts.
- Indexer or background jobs for chain reconciliation.
- Rate limiting and abuse detection.
- Multi-region/game-specific rules.
- Mainnet readiness and incident runbooks.

