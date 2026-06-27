# SkillFi Arena Repository Map

## Scope Reviewed

Repository root: `D:\e-spor`

This review covers the active Next.js app, root-level stranded source files, database migration, Solidity contracts, nested Hardhat scaffold, environment examples, package scripts, and generated/build artifacts. Generated outputs such as `.next`, `web3/artifacts`, `web3/cache`, and `web3/types` are treated as repository hygiene signals rather than source of truth.

## Top-Level Structure

| Path | Purpose | Current Status |
| --- | --- | --- |
| `app/` | Active Next.js App Router tree | Partially wired. Contains layout, home page, providers, and an incorrect route at `app/matches/create/route.ts`. Missing `app/api/*` routes referenced by UI/docs. |
| `components/` | Active React UI components imported by `app/page.tsx` | Older implementation. Uses wallet-address lookup and RainbowKit imports that do not match package dependencies. |
| `lib/` | Active frontend/server shared utilities | Partially active. Contains Supabase clients, contract constants, Wagmi config, types, and escrow ABI. Missing active `lib/privy.ts`. |
| `contracts/` | SkillFi-specific Solidity contracts and deployment script | Contains `SkillFiEscrowV2`, `MockUSDC`, and a Hardhat 2-style config/deploy script, but no package file or tests in this folder. |
| `web3/` | Nested Hardhat 3 sample workspace | Mostly scaffold/sample Counter project, not integrated with SkillFi contracts. Has generated artifacts committed. |
| `mnt/user-data/outputs/skillfi-arena/` | Stranded generated output | Contains a newer intended `/api/matches/create` route, but it is not active in the app. |
| Root-level `*.tsx` / `*.ts` files | Stranded newer app implementations | Appear to be intended replacements for active files, but are outside `app/`, `components/`, and `lib/`, so Next.js does not use them. |
| `.env.local.example` | Environment variable documentation | Present. Includes Supabase, Privy, contract, and RPC variables. |
| `.env.local` / `contracts/.env` | Local secrets/config | Present. Not documented here by value. Should not be committed. |

## Active Next.js App Files

| File | Role | Notes |
| --- | --- | --- |
| `app/layout.tsx` | Root layout and fonts | Imports `{ Providers }` from `./providers`, but active `app/providers.tsx` exports a default function. This is a build-breaking mismatch. |
| `app/page.tsx` | Server-rendered lobby data loader | Fetches public `matches` and `games` through anon Supabase client and renders `components/LobbyClient`. |
| `app/providers.tsx` | Active Privy/Wagmi/React Query providers | Uses `@privy-io/wagmi`, but creates local config with Base/Mainnet instead of the central `lib/wagmi.ts` config. Exports default, not named. |
| `app/globals.css` | Tailwind base/utilities | Defines arena theme grid utility. |
| `app/matches/create/route.ts` | Route handler, but at non-API path | Old implementation. Expects Supabase Auth semantics for Privy token and trusts client-supplied match data. Client posts to `/api/matches/create`, so this route is not reached by the current modal. |

## Active Component Files

| File | Role | Notes |
| --- | --- | --- |
| `components/LobbyClient.tsx` | Lobby UI, realtime match subscription, create modal launcher | Resolves current user by connected wallet address through public Supabase read. Does not use the root-level `AuthSync` onboarding flow. |
| `components/CreateChallengeModal.tsx` | Challenge creation flow | Performs ERC20 approval, calls `SkillFiEscrow.createMatch`, then posts to `/api/matches/create`. Does not attach a Privy authorization token, and the route does not exist in active `app/api`. |
| `components/ChallengeCard.tsx` | Challenge display | Join button is intentionally disabled. Stake formatting assumes 18 decimals. |
| `components/WalletConnect.tsx` | Wallet connect UI | Imports `@rainbow-me/rainbowkit`, which is not listed in root `package.json`. |
| `components/SupabaseSync.tsx` | Privy-token Supabase client hook | Not imported by active app. Encodes the obsolete pattern rejected by `README.md` and migration comments. |

## Active Library Files

| File | Role | Notes |
| --- | --- | --- |
| `lib/supabaseClient.ts` | Browser/server anon Supabase client factory | Exports `getSupabaseClient(privyAccessToken?)`, which conflicts with the documented Privy-only server verification architecture. Does not export `supabase`, although `app/page.tsx` and `components/LobbyClient.tsx` import it. |
| `lib/supabaseAdmin.ts` | Server-only Supabase service-role client | Correctly guarded with `server-only`. |
| `lib/wagmi.ts` | Wagmi config | Imports RainbowKit `getDefaultConfig`, but RainbowKit is not a dependency. |
| `lib/contracts.ts` | Active chain and contract env validation | Defaults to Base Sepolia and validates escrow/GNESS addresses. |
| `lib/types.ts` | Handwritten table/domain types | Covers users, games, matches, and lobby relation shape. |
| `lib/abi/skillFiEscrow.ts` | Hand-trimmed ABI | Matches an older `bytes32` escrow interface, not `contracts/SkillFiEscrowV2.sol`'s `uint256` operator-created match design. |

## Stranded Root-Level App Files

| File | Intended Role | Integration Status |
| --- | --- | --- |
| `providers.tsx` | Improved active provider with named `Providers`, central `wagmiConfig`, `AuthSync`, and Privy config | Not active. Should likely move to `app/providers.tsx` after review. |
| `AuthSync.tsx` | Privy account sync context | Not active. References `/api/auth/sync`, which is missing from active app. |
| `OnboardingCard.tsx` | First-time profile creation UI | Not active. |
| `LobbyClient.tsx` | Improved lobby using `useSkillFiUser()` and onboarding | Not active. |
| `WalletConnect.tsx` | Privy-native login/logout button | Not active. |
| `route.ts` | Intended `/api/auth/sync` route | Not active. Must be placed under `app/api/auth/sync/route.ts` and verified. |
| `privy.ts` | Server-only Privy verifier/client | Not active. Must be placed under `lib/privy.ts`. |
| `supabaseClient.ts` | Improved anon-only Supabase client | Not active. Must be reconciled with `lib/supabaseClient.ts`. |
| `wagmi.ts` | Improved Privy Wagmi config | Not active. Must be reconciled with `lib/wagmi.ts`. |

## Database Files

| File | Role | Notes |
| --- | --- | --- |
| `02_privy_identity_migration.sql` | Migration from Supabase Auth identity to Privy identity | Good architectural intent. References routes that are missing from active `app/api`. The base schema file referenced by README is not present in this repository. |

## Smart Contract Files

| File | Role | Notes |
| --- | --- | --- |
| `contracts/SkillFiEscrowV2.sol` | SkillFi escrow contract | Role-based operator creates matches; players join/deposit; supports start, resolve, dispute, cancel, expire, pause, fee config. Not aligned with frontend ABI/flow. |
| `contracts/MockUSDC.sol` | Mock ERC20 token | Uses 18 decimals despite USDC naming. |
| `contracts/hardhat.config.ts` | Hardhat config | Uses Hardhat 2 toolbox import, but no package file exists in `contracts/`. |
| `contracts/deploy.ts` | Deploys mock token and escrow | Standalone script tied to `contracts/` config. |

## Nested `web3/` Workspace

| File/Path | Role | Notes |
| --- | --- | --- |
| `web3/package.json` | Hardhat 3 package | `npm run test` intentionally fails with placeholder script. |
| `web3/hardhat.config.ts` | Hardhat 3 config | Configures sample networks and Counter project. |
| `web3/contracts/Counter.sol` | Sample contract | Not related to SkillFi. |
| `web3/test/Counter.ts` and `web3/contracts/Counter.t.sol` | Sample tests | Not related to SkillFi. |
| `web3/ignition/modules/Counter.ts` | Sample deployment module | Not related to SkillFi. |
| `web3/artifacts`, `web3/cache`, `web3/types` | Generated outputs | Committed despite `.gitignore` excluding them. |

## Scripts and Verification

| Command | Result During Review |
| --- | --- |
| `npm run build` | Started `next build`, then hung at `Creating an optimized production build ...` for several minutes. Stopped the stuck verification process. |
| `npm run lint` | Failed because `next lint` prompted interactively to configure ESLint. |
| `cd web3; npm run test` | Failed by design: script is `echo "Error: no test specified" && exit 1`. |

