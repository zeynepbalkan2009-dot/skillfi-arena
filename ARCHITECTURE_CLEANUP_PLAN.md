# Architecture Cleanup Plan

## Objective

Make `D:\e-spor` a single-source-of-truth production codebase without adding new product features. The cleanup focuses on resolving duplicate implementations, dead routes, conflicting configs, and broken tooling so the repository can be built and checked reliably.

## Split Architecture Findings

### Active Files Before Cleanup

- `app/layout.tsx`
- `app/page.tsx`
- `app/providers.tsx`
- `app/globals.css`
- `app/matches/create/route.ts`
- `components/ChallengeCard.tsx`
- `components/CreateChallengeModal.tsx`
- `components/LobbyClient.tsx`
- `components/SupabaseSync.tsx`
- `components/WalletConnect.tsx`
- `lib/abi/skillFiEscrow.ts`
- `lib/contracts.ts`
- `lib/supabaseAdmin.ts`
- `lib/supabaseClient.ts`
- `lib/types.ts`
- `lib/wagmi.ts`
- `contracts/*`
- `web3/*`

### Abandoned or Stranded Implementations

- Root `providers.tsx`
- Root `LobbyClient.tsx`
- Root `WalletConnect.tsx`
- Root `AuthSync.tsx`
- Root `OnboardingCard.tsx`
- Root `supabaseClient.ts`
- Root `wagmi.ts`
- Root `privy.ts`
- Root `route.ts`
- `mnt/user-data/outputs/skillfi-arena/app/api/matches/create/route.ts`

These files are more aligned with the documented Privy/service-role architecture than the active files, but they are not in the paths Next.js uses.

### Duplicate Components and Utilities

| Concern | Active Version | Stranded Version | Resolution |
| --- | --- | --- | --- |
| App providers | `app/providers.tsx` | `providers.tsx` | Merge stranded version into active path. |
| Lobby identity | `components/LobbyClient.tsx` | `LobbyClient.tsx` | Merge stranded version into active path. |
| Wallet connect | `components/WalletConnect.tsx` | `WalletConnect.tsx` | Merge stranded Privy-native version into active path. |
| Supabase client | `lib/supabaseClient.ts` | `supabaseClient.ts` | Merge stranded anon-only client into active path. |
| Wagmi config | `lib/wagmi.ts` | `wagmi.ts` | Merge stranded Privy Wagmi config into active path. |
| Privy verifier | missing active file | `privy.ts` | Move to `lib/privy.ts`. |
| Auth sync UI | missing active files | `AuthSync.tsx`, `OnboardingCard.tsx` | Move to `components/`. |
| Auth sync route | missing active route | `route.ts` | Move to `app/api/auth/sync/route.ts`. |
| Match create route | wrong/insecure active route | generated route under `mnt/` | Move generated route to `app/api/matches/create/route.ts`. |

### Unused Routes and Dead Code

- `app/matches/create/route.ts` is an API-style route at the wrong URL. The client posts to `/api/matches/create`, so this active route is unused.
- `components/SupabaseSync.tsx` encodes the obsolete "Privy token as Supabase Authorization header" pattern and is unused.
- Root-level stranded source files should be removed after their content is merged.
- `mnt/user-data/outputs/skillfi-arena` should be removed after the only useful generated route is merged.

### Conflicting Configs

- Root `package.json` has an invalid scripts object and no non-interactive typecheck/lint baseline.
- Active `lib/wagmi.ts` imports RainbowKit, but RainbowKit is not a dependency.
- Active `components/WalletConnect.tsx` imports RainbowKit, but the project now depends on Privy.
- `web3/package.json` has a placeholder failing test script.
- `web3` is a sample Hardhat Counter workspace, while SkillFi contracts live in root `contracts/`.

## Files to Keep

- `app/layout.tsx`
- `app/page.tsx`
- `app/providers.tsx` after merge
- `app/globals.css`
- `app/api/auth/sync/route.ts` after merge
- `app/api/matches/create/route.ts` after merge
- `components/ChallengeCard.tsx`
- `components/CreateChallengeModal.tsx`
- `components/LobbyClient.tsx` after merge
- `components/WalletConnect.tsx` after merge
- `components/AuthSync.tsx` after merge
- `components/OnboardingCard.tsx` after merge
- `lib/abi/skillFiEscrow.ts`
- `lib/contracts.ts`
- `lib/privy.ts` after merge
- `lib/supabaseAdmin.ts`
- `lib/supabaseClient.ts` after merge
- `lib/types.ts`
- `lib/wagmi.ts` after merge
- `contracts/*`
- `web3/*` as the current Hardhat workspace, with scripts fixed
- Existing review docs

## Files to Remove

- Root `providers.tsx`
- Root `LobbyClient.tsx`
- Root `WalletConnect.tsx`
- Root `AuthSync.tsx`
- Root `OnboardingCard.tsx`
- Root `supabaseClient.ts`
- Root `wagmi.ts`
- Root `privy.ts`
- Root `route.ts`
- `components/SupabaseSync.tsx`
- `app/matches/create/route.ts`
- Empty `app/matches/create` / `app/matches` directories after route removal
- `mnt/user-data/outputs/skillfi-arena` after merging its route

## Files to Merge

- `providers.tsx` into `app/providers.tsx`
- `LobbyClient.tsx` into `components/LobbyClient.tsx`
- `WalletConnect.tsx` into `components/WalletConnect.tsx`
- `AuthSync.tsx` into `components/AuthSync.tsx`
- `OnboardingCard.tsx` into `components/OnboardingCard.tsx`
- `supabaseClient.ts` into `lib/supabaseClient.ts`
- `wagmi.ts` into `lib/wagmi.ts`
- `privy.ts` into `lib/privy.ts`
- `route.ts` into `app/api/auth/sync/route.ts`
- `mnt/user-data/outputs/skillfi-arena/app/api/matches/create/route.ts` into `app/api/matches/create/route.ts`

## Migration Steps

1. Fix root `package.json` scripts so npm can parse and run tooling.
2. Add ESLint config and a non-interactive `typecheck` script.
3. Move/merge stranded canonical files into active app paths.
4. Remove dead active route and obsolete Supabase token helper component.
5. Remove root-level stranded copies after successful merge.
6. Configure `web3/package.json` with real Hardhat scripts.
7. Run frontend checks: `npm run lint`, `npm run typecheck`, `npm run build`.
8. Run Web3 checks: `npm install`, `npm run test`, `npx hardhat compile`.
9. Document changed files and verification results in `CLEANUP_REPORT.md`.

## Risks

- Activating the existing Privy auth-sync layer can expose type errors in `@privy-io/node` usage that were hidden while the file was stranded.
- The verified match-create route can expose ABI/contract drift at typecheck time.
- `next build` may still depend on valid local environment variables and network-free behavior.
- Web3 has since been consolidated into `web3/`; see `WEB3_CONSOLIDATION_REPORT.md`.
- The frontend escrow ABI still conflicts with `web3/contracts/SkillFiEscrowV2.sol`; resolving that would change product integration behavior and remains intentionally deferred to `TODO.md`.
