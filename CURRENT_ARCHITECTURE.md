# Current Architecture

SkillFi Arena is now consolidated around the active Next.js App Router application plus the canonical `web3/` Hardhat workspace.

## Runtime Stack

| Layer | Technology | Current Role |
| --- | --- | --- |
| Web app | Next.js 14, React 18, TypeScript | Lobby, profile, challenge creation, invitation, acceptance |
| Identity | Privy | Login and verified server-side identity |
| Database | Supabase/Postgres | Profiles, challenges, matches, participants, realtime lobby |
| Wallet/Web3 | Privy/Wagmi/Viem | Provider wiring retained; escrow actions deferred |
| Contracts | Hardhat, Solidity | `SkillFiEscrowV2` and `MockUSDC` verified separately in `web3/` |

## Active Product Flow

The current sprint implements an off-chain two-player challenge flow:

1. Privy login.
2. Server-side profile sync.
3. Lobby challenge creation through `/api/matches/create`.
4. Hashed-token invitation URL generation.
5. Invitation detail page at `/challenge/[token]`.
6. Authenticated challenge acceptance through `/api/challenges/[id]/accept`.
7. Atomic `accept_challenge` RPC creates the canonical match and participant rows.
8. Lobby renders open and accepted challenges from `public.challenges`.

Escrow approval, deposits, gameplay, result settlement, and payout are intentionally not part of this sprint.

## Module Boundaries

| Boundary | Rule |
| --- | --- |
| Client components | Privy login, public reads, form submission, realtime UI |
| Route handlers | Token verification, validation, service-role writes |
| `lib/auth/server.ts` | Verified Privy identity to SkillFi profile |
| `lib/supabaseClient.ts` | Browser-safe Supabase anon client |
| `lib/supabaseAdmin.ts` | Lazy server-only service-role client |
| `03_two_player_challenge_flow.sql` | Profile/challenge/match schema and atomic acceptance RPC |

## Contract Boundary

`web3/` remains production-tested with 48 passing tests. The web app no longer pretends that challenge creation performs an escrow deposit. Contract approval/deposit integration is a later sprint and must align with `SkillFiEscrowV2`.
