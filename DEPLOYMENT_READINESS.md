# SkillFi Arena — Deployment Readiness

## Security hardening status

The current production deployment still points at the legacy `SkillFiEscrowV2` contract. The security-hardening branch introduces `SkillFiEscrowV3`; do not promote this branch to production until V3 is deployed and the production environment points at the new address.

- Active target: Arc Testnet
- Canonical Arc USDC: `0x3600000000000000000000000000000000000000`
- Hosting project: linked to GitHub and deploying from `main`
- Public URL: `https://skillfi-arena.vercel.app`
- Required hosted schema version: `17`
- Required application Node line: `22.x`
- Required escrow implementation: `SkillFiEscrowV3`

## Required hosting environment variables

Copy values from secure provider dashboards or secret stores. Never paste private keys or service-role secrets into source control, build logs, issues, or grant documents.

### Public

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or the supported publishable-key equivalent
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — must be a real project ID; placeholder values are rejected
- `NEXT_PUBLIC_CHAIN_TARGET=arcTestnet`
- `NEXT_PUBLIC_ESCROW_ADDRESS=<SkillFiEscrowV3 deployment address>`
- `NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0x3600000000000000000000000000000000000000`
- `NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network`
- `NEXT_PUBLIC_CONTACT_EMAIL` after public-contact approval

### Server-only

- `SUPABASE_SERVICE_ROLE_KEY`
- `PRIVY_APP_SECRET`
- `OPERATOR_PRIVATE_KEY` — key for the dedicated V3 operator only
- `RPC_URL=https://rpc.testnet.arc.network`
- `OPERATOR_WALLET_ADDRESS=<dedicated operator address>`
- `STUDIO_ADMIN_USER_IDS` and/or `STUDIO_ADMIN_WALLET_ADDRESSES` for explicit web-admin identities
- studio listing fee variables required by the active environment

The following variables must not exist in hosted production or preview environments:

- `SKILLFI_TEST_PRIVY_TOKEN_MAP`
- `SKILLFI_TEST_PRIVY_USERS`

## Contract release gate

Before changing `NEXT_PUBLIC_ESCROW_ADDRESS`:

1. Deploy `SkillFiEscrowV3` using `web3/scripts/deploy-arc.ts` from a secure signer environment.
2. Use separate addresses for deployer/admin, operator, arbiter, and treasury. The deploy script refuses overlapping addresses.
3. Run `web3/scripts/validate-arc-deployment.mjs` against the generated `web3/deployments/arc-testnet-v3.json`.
4. Confirm the dedicated application operator has `OPERATOR_ROLE`.
5. If rotating an operator, provide `ARC_PREVIOUS_OPERATOR_ADDRESS` so the rotation script verifies the new role before revoking the old one.
6. Record the new V3 address in the deployment environment; do not overwrite the historical V2 deployment record.

## Database release gate

Apply the canonical hosted migration chain in `MIGRATION_ORDER.md` through `supabase/17_disable_test_fixture_games.sql`, then reload PostgREST schema cache.

Required checks:

- `public.schema_release_state.version = 17`
- anonymous access to `public.users` is column-scoped to public-safe profile fields
- `guilds` is accessible to the service role
- API rate-limit RPC is installed
- risk idempotency hardening is installed
- `HTTP Validation %` fixture games are inactive/suspended

## Application release gate

- Set Vercel/hosting Node runtime to `22.x` to match `.nvmrc`, package engines, and CI.
- Upgrade to the patched Next.js 15.5.24 line with a matching lockfile.
- Run `npm ci`.
- Run `npm run typecheck`.
- Run `npm run test:product`.
- Run `npm run build`.
- Run Hardhat compile/tests, including `SkillFiEscrowV3.security.ts`.
- Verify Privy login, embedded/external wallet connection, challenge lobby, studio portal, and CSP behavior in Preview.
- Confirm `/api/health` returns HTTP 200 with `status: ok` only after V3/operator and schema 17 are configured.
- Keep real-value/mainnet deposits disabled until the security PR is merged, V3 is deployed, hosted migrations are applied, and the final smoke tests pass.

## Production promotion order

Use this order to avoid application/schema/contract drift:

1. Merge code only after CI and Preview validation.
2. Apply hosted database migrations through version 17.
3. Deploy and validate Escrow V3 with separated roles.
4. Configure production environment values, including the V3 escrow and valid WalletConnect ID.
5. Set the Vercel Node runtime to 22.x.
6. Deploy/Promote the application.
7. Check `/api/health` and authenticated smoke tests.
8. Only then enable any real-value settlement mode.
