# Security Review

## Stabilization Note

This document began as a pre-cleanup security review. Web3 contracts now live in `web3/`, token transfers use `SafeERC20`, and invariant tests cover refund/settlement terminal-state behavior. Remaining findings should be read together with `CONTRACT_DIFF_SECURITY_REVIEW.md` and `DEPENDENCY_SECURITY_REPORT.md`.

## Executive Summary

The intended security architecture is directionally sound: Privy tokens should be verified server-side, sensitive database access should use a server-only service-role client, and match creation should be backed by independently verified on-chain events.

The active implementation does not currently enforce that architecture. The highest-risk issues are broken/missing API routes, trusting invalid Supabase Auth semantics for Privy tokens, trusting client-submitted match data in the active route, and contract/interface drift.

## Positive Security Properties Present

- `lib/supabaseAdmin.ts` uses `import "server-only"` to guard the Supabase service role key.
- Root-level `privy.ts` also uses `import "server-only"` and verifies Privy access tokens with `@privy-io/node`.
- `02_privy_identity_migration.sql` correctly explains why Privy tokens should not be handed to Supabase as Auth JWTs.
- Stranded `/api/matches/create` implementation verifies transaction receipts and decodes escrow events before database insertion.
- Contract uses OpenZeppelin `AccessControl`, `ReentrancyGuard`, and `Pausable`.
- `SkillFiEscrowV2` protects settlement and cancellation through roles.

## Critical Findings

### 1. Active Match Creation Route Is Insecure and Misplaced

File: `app/matches/create/route.ts`

Issues:

- Maps to `/matches/create`, while client posts to `/api/matches/create`.
- Uses `getSupabaseClient(token)` and `supabase.auth.getUser()` with a Privy token, which the migration explicitly says does not work.
- Trusts client-submitted `matchId`, `stakeAmount`, and `gameId`.
- Does not verify an on-chain transaction receipt.
- Does not decode escrow events.
- Does not use `supabaseAdmin`.

Impact: if this route were reachable and RLS allowed the insert, a caller could create phantom matches without escrowed funds.

### 2. Missing Active Privy Verification Route

Files:

- missing `app/api/auth/sync/route.ts`
- missing `lib/privy.ts`
- stranded `route.ts`
- stranded `privy.ts`

Impact: active app has no integrated server-side Privy verification path for account provisioning.

### 3. Missing Active Verified Match API

Files:

- missing `app/api/matches/create/route.ts`
- stranded `mnt/user-data/outputs/skillfi-arena/app/api/matches/create/route.ts`

Impact: current challenge creation cannot securely register verified deposits.

### 4. Contract/Frontend Mismatch Can Break Fund Safety

Files:

- `lib/abi/skillFiEscrow.ts`
- `components/CreateChallengeModal.tsx`
- `web3/contracts/SkillFiEscrowV2.sol`

Impact: the UI may call functions/events that do not exist on the deployed contract, or may encode the wrong lifecycle assumption. A production Web3 app must not ship with ambiguous escrow semantics.

## High Findings

### 5. Browser Supabase Client Supports Privy Token Injection

File: `lib/supabaseClient.ts`

The active helper accepts a `privyAccessToken` and places it into the Supabase Authorization header. This is the exact pattern the migration says must be removed.

Impact: recurring identity bugs and possible accidental reliance on broken RLS assumptions.

### 6. No Risk-Limit Enforcement Before Stakes

Files:

- `components/CreateChallengeModal.tsx`
- `02_privy_identity_migration.sql`

Risk profiles are mentioned, but the active create flow does not read or enforce daily loss/stake limits before approval/deposit.

Impact: responsible-gaming and financial-risk controls are absent.

### 7. No Rate Limiting or Abuse Controls on Routes

Affected future/stranded routes:

- `/api/auth/sync`
- `/api/matches/create`

Impact: account creation, username probing, receipt probing, and match indexing can be abused without throttling.

### 8. Sensitive Local Env Files Exist

Files:

- `.env.local`
- `contracts/.env`

Values were not printed in this review. These files should remain untracked and secret-scanned.

Impact: accidental commit or leak would compromise service-role/RPC/private-key material depending on contents.

## Medium Findings

### 9. Root Sync Route Uses Private SDK Method

File: root `route.ts`

The route calls `privy.users()._get(privyUserId)`. The underscore suggests a non-public/internal method.

Impact: SDK upgrade fragility and possible production outage.

### 10. Wallet-to-User Binding Needs Explicit Policy

The stranded match creation route credits `player_a` based on the wallet in the chain event, not necessarily the authenticated Privy user's linked wallet. The comment notes relayer support as a reason.

Impact: this may be intentional, but production must decide whether relayers are allowed. If not, enforce caller wallet equals depositor wallet.

### 11. Contract Refunds Use SafeERC20 After Stabilization

File: `web3/contracts/SkillFiEscrowV2.sol`

`_refund`, settlement, and dispute resolution now use `SafeERC20`.

Impact: the original ERC20 return-value concern is resolved for the consolidated contract.

### 12. Operator-Created Match Design Requires Backend Key Security

File: `web3/contracts/SkillFiEscrowV2.sol`

`createMatch`, `startMatch`, `resolveMatch`, and `cancelMatch` rely on `OPERATOR_ROLE`.

Impact: the operator key becomes critical infrastructure and needs hardware custody or automated signer controls.

## Low Findings

- Raw database errors may leak schema details to clients.
- Console logging is used instead of structured security/audit logs.
- No audit trail exists for settlement decisions.
- No content validation beyond basic username presence is visible in stranded onboarding.
- No dependency vulnerability scan was run during this static review.

## Recommended Security Direction

1. Make the Privy server-verification path active.
2. Remove browser Supabase token injection.
3. Move verified match creation into active `/api/matches/create`.
4. Decide and enforce one contract lifecycle model.
5. Add tests for auth rejection, receipt verification, duplicate indexing, and wallet binding.
6. Add rate limiting and structured audit logs before public launch.
7. Add smart contract tests for deposits, double joins, refunds, disputes, fees, pause, and role authorization.
