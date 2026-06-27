# Technical Debt

## Highest-Risk Debt

### Active vs Stranded Implementation Split

The repository contains newer, likely intended files at the root level, while active Next.js imports still point to older files in `app/`, `components/`, and `lib/`. This creates duplicated logic, broken imports, and security ambiguity.

Affected examples:

- `components/LobbyClient.tsx` vs root `LobbyClient.tsx`
- `components/WalletConnect.tsx` vs root `WalletConnect.tsx`
- `app/providers.tsx` vs root `providers.tsx`
- `lib/supabaseClient.ts` vs root `supabaseClient.ts`
- missing active `lib/privy.ts` despite root `privy.ts`
- missing active `app/api/auth/sync/route.ts` despite root `route.ts`
- missing active `app/api/matches/create/route.ts` despite `mnt/user-data/outputs/.../route.ts`

### Build-Breaking Import/Export Mismatches

- `app/layout.tsx` imports named `{ Providers }`, but active `app/providers.tsx` exports default.
- `app/page.tsx` and `components/LobbyClient.tsx` import `supabase` from `@/lib/supabaseClient`, but active `lib/supabaseClient.ts` does not export `supabase`.
- `components/WalletConnect.tsx` and `lib/wagmi.ts` import `@rainbow-me/rainbowkit`, which is absent from root `package.json`.

### Contract/ABI Drift

`lib/abi/skillFiEscrow.ts` does not match `contracts/SkillFiEscrowV2.sol`. The app and contract encode different authority, match ID, deposit, event, and lifecycle models.

### Route Path Debt

The active route is `app/matches/create/route.ts`, but the client calls `/api/matches/create`. This is both a runtime bug and a sign that route handlers were copied into the wrong tree.

## Code Quality Debt

| Area | Debt |
| --- | --- |
| Type safety | `app/matches/create/route.ts` catches `error: any`; handwritten Supabase types can drift from schema. |
| Environment handling | Some active files use non-null assertions for env vars; root stranded files improve validation but are inactive. |
| State management | User identity is resolved through wallet lookup in active lobby, while intended context-based identity is stranded. |
| UI responsiveness | Challenge cards use fixed horizontal layout and may need mobile verification. |
| Numeric assumptions | Stake display assumes 18 decimals; token is named GNESS in UI, MockUSDC in contracts, and no runtime token metadata is stored with matches. |
| Error UX | Most failures surface raw messages or console logs; no toast/notification system. |
| Realtime correctness | Realtime handler fetches related user data per event and does not guard against out-of-order responses. |
| Idempotency | Stranded match create route has idempotency; active route does not. |
| Onboarding recovery | Root sync route logs risk-profile creation failure but does not retry idempotently for existing users missing risk profile. |

## Repository Hygiene Debt

- `.next` exists in the repository root.
- `web3/artifacts`, `web3/cache`, and `web3/types` are present despite generated-output ignore rules.
- `web3` is a sample Counter project rather than the SkillFi contract workspace.
- `contracts/` has Hardhat config and deploy script but no local package/test setup.
- Root-level source files are outside conventional folders and create ambiguity.
- Encoding mojibake appears in README/comments/output text, suggesting file encoding or terminal conversion issues.

## Testing and CI Debt

- No root test script.
- `next lint` is not configured and prompts interactively.
- `web3` test script intentionally fails.
- No tests for route handlers, Supabase integration, Privy auth sync, contract calls, or UI flows.
- No smart contract tests for `SkillFiEscrowV2`.
- No CI workflow present.
- Build verification currently hangs in local review rather than producing a clear pass/fail.

## Documentation Debt

- README describes routes and active files that are missing or not active.
- README mentions `supabase/02_privy_identity_migration.sql`, but the file is at root as `02_privy_identity_migration.sql`.
- Base schema file is referenced but absent.
- Contract deployment/address documentation is incomplete.
- The relationship between `contracts/` and `web3/` is unclear.

