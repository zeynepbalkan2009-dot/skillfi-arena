# SkillFi Arena

Production MVP workspace for SkillFi Arena: a Next.js Web3 esports lobby with Privy identity, Supabase-backed application data, Wagmi/Viem contract interactions, and a consolidated Hardhat smart-contract workspace.

## Workspaces

- `app/`, `components/`, `lib/` - active Next.js 14 App Router frontend.
- `web3/` - canonical Hardhat 3 workspace for SkillFi contracts, deployment scripts, and contract tests.
- `02_privy_identity_migration.sql` - Supabase migration for Privy-based identity.

## Frontend Setup

```shell
npm install --legacy-peer-deps
cp .env.local.example .env.local
npm run dev
```

Required environment values are documented in `.env.local.example`.

Privy is the active auth provider. Supabase browser usage is anon/public only; authenticated writes go through route handlers that verify Privy access tokens server-side.

## Frontend Verification

```shell
npm run lint
npm run typecheck
npm run build
npm run start
```

`next.config.mjs` contains the current Privy build compatibility settings. See `BUILD_STALL_ROOT_CAUSE.md` and `PRIVY_BUILD_COMPATIBILITY.md` before changing them.

## Web3 Setup

```shell
cd web3
npm install
cp .env.example .env
npm run compile
npm run test
```

`web3/` contains `SkillFiEscrowV2.sol` and `MockUSDC.sol`. The old sample Counter workspace has been removed.

## Stabilization Reports

- `ARCHITECTURE_CLEANUP_PLAN.md`
- `CLEANUP_REPORT.md`
- `BUILD_STALL_INVESTIGATION.md`
- `BUILD_STALL_ROOT_CAUSE.md`
- `PRIVY_BUILD_COMPATIBILITY.md`
- `WEB3_CONSOLIDATION_REPORT.md`
- `CONTRACT_DIFF_SECURITY_REVIEW.md`
- `USDC_DECIMAL_AUDIT.md`
- `DEPENDENCY_SECURITY_REPORT.md`
- `TODO.md`
