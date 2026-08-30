# SkillFi Arena

## Five-game test pilot

The `/pilot/games` lab contains five original, deterministic skill-game prototypes: Typing Sprint, Arithmetic Rush, Sequence Recall, Pattern Lock, and Logic Grid. It intentionally uses no deposits, prizes, or blockchain transactions.

To validate 100 concurrent read-only pilot visits against a running production build:

```bash
npm run build
npm start
npm run test:load:100
```

Set `SKILLFI_LOAD_URL` to test an authorized staging deployment. The load script does not create users, matches, financial transactions, or other persistent data. Passing it validates the listed public page requests under one local burst; it is not evidence that wallet, database, settlement, or real-world 100-player behavior has been fully load-tested.

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
