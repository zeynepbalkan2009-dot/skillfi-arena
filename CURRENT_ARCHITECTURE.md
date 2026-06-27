# Current Architecture

## Executive Summary

SkillFi Arena is intended to be a Next.js 14 App Router application for Web3 esports challenges, backed by Supabase, Privy identity, Wagmi/Viem contract calls, and an escrow smart contract.

The current repository contains two architecture layers:

1. The active architecture under `app/`, `components/`, and `lib/`, which is partially broken and internally inconsistent.
2. A newer intended architecture stranded in root-level files and `mnt/user-data/outputs/skillfi-arena`, which better matches the README but is not integrated into the active application.

Production work should first reconcile these layers into one active implementation.

## Runtime Stack

| Layer | Technology | Current Use |
| --- | --- | --- |
| Web app | Next.js 14 App Router, React 18, TypeScript | Active lobby page and modal flow. |
| Styling | Tailwind CSS | Dark arena visual system via custom theme tokens. |
| Identity | Privy | Active provider exists, but active user sync/onboarding is incomplete. |
| Wallet/Web3 | Wagmi, `@privy-io/wagmi`, Viem | Modal uses Wagmi hooks and Viem utilities. Active wallet config conflicts with `lib/wagmi.ts`. |
| Database | Supabase/Postgres | Public lobby reads and realtime subscription. Service-role pattern exists only partially. |
| Smart contracts | Solidity, OpenZeppelin, Hardhat | SkillFi escrow contract exists but is not integrated with active frontend ABI/flow. |

## Intended Product Flow

### Public Lobby

1. `app/page.tsx` fetches active games and searching matches from Supabase.
2. `components/LobbyClient.tsx` renders challenge cards.
3. A realtime Supabase channel watches `matches` changes and updates the lobby.

### Authentication and Account Provisioning

The README and migration establish the intended architecture:

1. Privy is the only identity provider.
2. Privy access tokens are verified server-side with `@privy-io/node`.
3. Verified Privy DIDs map to `public.users.privy_user_id`.
4. Sensitive reads/writes use `supabaseAdmin` with the service role key.
5. Browser Supabase access is limited to public reads and realtime.

Current active app status:

- `app/providers.tsx` configures Privy, React Query, and Wagmi.
- Active components do not use `AuthSync`.
- `app/api/auth/sync/route.ts` does not exist.
- `lib/privy.ts` does not exist.
- Root-level stranded files contain the intended `AuthSync`, onboarding, Privy verifier, and sync route.

### Challenge Creation

The intended secure flow is:

1. Client approves the escrow contract to spend GNESS.
2. Client creates/deposits on-chain.
3. Client sends `txHash`, `matchId`, `gameId`, and Privy bearer token to `/api/matches/create`.
4. Server verifies the Privy token.
5. Server fetches and validates the transaction receipt.
6. Server decodes `MatchCreated`.
7. Server resolves the depositor wallet to a SkillFi user.
8. Server writes the verified match with `service_role`.

Current active app status:

- `components/CreateChallengeModal.tsx` performs approval and `createMatch`.
- It posts to `/api/matches/create`.
- Active repository has no `app/api/matches/create/route.ts`.
- Existing active route is `app/matches/create/route.ts`, which maps to `/matches/create`, not `/api/matches/create`.
- That active route trusts Supabase Auth semantics that do not work for Privy and trusts client-submitted match data.
- A stronger intended route exists at `mnt/user-data/outputs/skillfi-arena/app/api/matches/create/route.ts`, but is inactive.

## Data Model Inferred From Code

The source assumes these tables:

| Table | Fields Used |
| --- | --- |
| `games` | `id`, `name`, `type`, `is_active`, `created_at` |
| `users` | `id`, `username`, `region`, `wallet_address`, `privy_user_id` |
| `matches` | `id`, `smart_contract_match_id`, `game_id`, `player_a_id`, `player_b_id`, `stake_amount`, `status`, `winner_id`, `created_at`, `updated_at` |
| `user_risk_profiles` | `user_id` during onboarding risk profile creation in stranded route |
| `transactions` | Mentioned by migration/README, not used by active code |
| `ratings` | Mentioned by README/types comments, not used by active code |

The base schema is not present in the repo, so database verification depends on external Supabase state.

## Smart Contract Architecture

There are two conflicting contract models:

### Frontend ABI Model

`lib/abi/skillFiEscrow.ts` assumes:

- `createMatch(bytes32 _matchId, uint256 _entryFee)` is called by the player.
- `MatchCreated(bytes32 indexed matchId, address indexed playerA, uint256 entryFee, uint256 timestamp)` is emitted.
- `matches(bytes32)` returns a struct including player addresses and entry fee.

### `SkillFiEscrowV2` Model

`contracts/SkillFiEscrowV2.sol` implements:

- `createMatch(uint256 matchId, uint256 entryFee)` is `onlyRole(OPERATOR_ROLE)` and does not deposit player funds.
- `joinMatch(uint256 matchId)` deposits ERC20 tokens for player slots.
- Status lifecycle: `WAITING_FOR_PLAYERS`, `READY`, `IN_PROGRESS`, `RESOLVED`, `DISPUTED`, `CANCELLED`, `EXPIRED`.
- Operator/arbiter/admin roles.
- Platform fee and treasury.

These models are incompatible. The frontend currently cannot correctly operate `SkillFiEscrowV2` as written.

## Module Boundaries

| Boundary | Intended Rule | Current State |
| --- | --- | --- |
| Client UI | Public reads, wallet actions, Privy login | Partially implemented. |
| Server routes | Identity verification, private reads/writes, chain verification | Mostly missing from active paths. |
| Supabase anon client | Public lobby data and realtime only | Active `lib/supabaseClient.ts` still supports token injection. |
| Supabase service role | Server-only privileged operations | Correct helper exists, but active routes do not use the intended pattern. |
| Contracts | Escrow funds and settlement authority | Contract exists but not aligned with UI/ABI. |

## Current Build/Test Architecture

- Root app has scripts for `dev`, `build`, `start`, and `lint`.
- `lint` is not configured and prompts interactively.
- No root test script exists.
- Nested `web3` workspace has sample tests, but its `test` script is a placeholder failure.
- Generated Hardhat outputs are committed in `web3`.

