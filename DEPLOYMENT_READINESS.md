# SkillFi Arena — Deployment Readiness

## Security hardening status

The current production deployment still points at the legacy `SkillFiEscrowV2` contract. The security-hardening branch introduces `SkillFiEscrowV3`; do not promote this branch to production until V3 is deployed, validated, and the production environment points at the new address.

- Active target: Arc Testnet
- Canonical Arc USDC: `0x3600000000000000000000000000000000000000`
- Hosting project: linked to GitHub and deploying from `main`
- Public URL: `https://skillfi-arena.vercel.app`
- Required hosted schema version: `21`
- Required application Node line: `22.x`
- Required Next.js line: `15.5.25`
- Required escrow implementation: `SkillFiEscrowV3`
- Required critical identities: five distinct addresses — deployer, admin, operator, arbiter, and treasury

## Required hosting environment variables

Copy values from secure provider dashboards or secret stores. Never paste private keys or service-role secrets into source control, build logs, issues, or grant documents.

### Public

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or the supported publishable-key equivalent
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — must be a real project ID; placeholder values are rejected
- `NEXT_PUBLIC_CHAIN_TARGET=arcTestnet`
- `NEXT_PUBLIC_ESCROW_ADDRESS=<validated SkillFiEscrowV3 deployment address>`
- `NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0x3600000000000000000000000000000000000000`
- `NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network`
- `NEXT_PUBLIC_CONTACT_EMAIL` after public-contact approval

### Server-only

- `SUPABASE_SERVICE_ROLE_KEY`
- `PRIVY_APP_SECRET`
- `OPERATOR_PRIVATE_KEY` — key for the dedicated V3 operator only
- `RPC_URL=https://rpc.testnet.arc.network`
- `OPERATOR_WALLET_ADDRESS=<dedicated V3 operator address>`
- `STUDIO_ADMIN_USER_IDS` and/or `STUDIO_ADMIN_WALLET_ADDRESSES` for explicit web-admin identities
- `STUDIO_LISTING_FEE_USDC` and `STUDIO_FEE_TREASURY_ADDRESS` where studio listing fees are enabled

The following variables must not exist in hosted production or preview environments:

- `SKILLFI_TEST_PRIVY_TOKEN_MAP`
- `SKILLFI_TEST_PRIVY_USERS`

## Contract release gate

Before changing `NEXT_PUBLIC_ESCROW_ADDRESS`:

1. Deploy `SkillFiEscrowV3` using `web3/scripts/deploy-arc.ts` from a secure signer environment.
2. Use five distinct addresses for deployer, admin, operator, arbiter, and treasury. The contract and deployment tooling reject critical identity overlap.
3. Keep the persistent admin separate from the deployer. For value-bearing governance, use an appropriate controlled or multisig admin process rather than a shared hot key.
4. Run `web3/scripts/validate-arc-deployment.mjs` against the generated `web3/deployments/arc-testnet-v3.json`.
5. Confirm the runtime-code hash, canonical USDC address, role membership, treasury, fee policy, timeout policy, and pause state match the deployment manifest.
6. Run the Arc match and safety smoke paths against that exact V3 deployment.
7. Confirm the dedicated application operator has `OPERATOR_ROLE` and is not also admin, arbiter, or treasury.
8. If rotating an operator, provide `ARC_PREVIOUS_OPERATOR_ADDRESS`; verify the new operator before revoking the old role.
9. Record the V3 address in the deployment environment; never overwrite the historical V2 deployment record.

## Database release gate

Apply the canonical hosted migration chain in `MIGRATION_ORDER.md` through `supabase/21_rotate_game_api_key_hashes.sql`, then reload the PostgREST schema cache.

Required checks:

- `public.schema_release_state.version = 21`
- anonymous/authenticated access to `public.users` is column-scoped to public-safe profile fields
- direct public reads cannot enumerate `challenges`, `challenge_participants`, or `match_participants`
- public match reads expose only the intended projected columns
- `public.matches` is absent from the `supabase_realtime` publication
- `guilds` is accessible to the service role
- API rate-limit RPC is installed and sensitive rate-limit state remains service-role only
- risk idempotency hardening is installed
- settlement single-writer RPCs are installed and service-role only
- `HTTP Validation %` fixture games are inactive/suspended
- all pre-schema-21 integration credentials are revoked
- replacement studio integration credentials use the new 12-hex prefix + scrypt model before integrations resume

## Application release gate

- Keep `.nvmrc`, package `engines.node`, and CI on Node `22.x`.
- Vercel's project UI may still display Node `24.x`; the build is acceptable only if the build log confirms package `engines.node=22.x` overrides the project setting and Node 22 is actually used. Align the project setting to 22.x when possible.
- Use Next.js `15.5.25` with the committed lockfile and production dependency overrides.
- Run `npm ci --no-audit` followed by the repository's fail-closed production advisory gate.
- Run `npm run typecheck`.
- Run `npm run test:product`.
- Run `npm run build`.
- Run web3 release-tooling typecheck, Hardhat compile, and the full Hardhat test suite including `SkillFiEscrowV3.security.ts`.
- Require CodeQL and Live Match Type Check to pass on the exact release head.
- Verify Privy login, embedded/external wallet connection, challenge lobby, studio portal, polling-based live match state, CSP, HSTS, and no-store behavior in an exact-head Preview.
- Confirm `/api/health` returns HTTP 200 with `status: ok` only after schema 21, V3/operator, and studio economic configuration are applied.
- Keep real-value/mainnet deposits disabled until every release gate below is complete.

## GitHub / CI release gate

- `main` must have branch protection or an equivalent ruleset requiring PR review/status checks before value-bearing production release.
- Required checks should include the main CI, Live Match Type Check, CodeQL, and the relevant Vercel deployment check.
- Permanent GitHub Actions must remain pinned to immutable commit SHAs.
- Do not treat a green GitHub CI run as proof that Supabase migrations, V3 deployment, or production environment values are current.

## Vercel Preview gate

- The Preview must correspond to the exact release commit SHA.
- A READY Preview from an earlier hardening commit is not sufficient.
- Inspect build logs to confirm Node 22 is actually used.
- Smoke-test the landing page and security-sensitive routes/headers.
- If Vercel reports `build-rate-limit`, wait for the platform limit to clear or change the account capacity; do not create meaningless commits merely to retrigger builds.

## Production promotion order

Coordinate this sequence so GitHub-to-Vercel automatic production deployment cannot expose a code/schema/contract mismatch.

1. Freeze the release head after exact-head GitHub CI, CodeQL, Live Match Type Check, and Preview validation are green.
2. Prepare and validate the V3 Arc deployment with five distinct critical identities, but do not point production at it yet.
3. Prepare replacement studio integration credentials and a rotation plan because schema 21 revokes legacy credential hashes.
4. Before merging to `main`, ensure automatic production promotion is paused/controlled or use a coordinated maintenance window. Do not merge a schema-21-dependent application while Vercel can immediately auto-promote it against the old database/contract configuration.
5. Apply hosted Supabase migrations through version 21 and reload PostgREST schema cache.
6. Issue/activate replacement studio integration credentials required after schema 21.
7. Configure production environment values to the validated V3 escrow, dedicated operator, valid WalletConnect project ID, and required studio economic configuration. Ensure test-auth variables are absent.
8. Merge/promote the exact validated application commit and confirm Vercel builds it with Node 22.
9. Verify `/api/health`, authentication, lobby/match flows, settlement/refund/dispute smoke paths, CSP/HSTS/no-store headers, and runtime error logs.
10. Enable any real-value settlement mode only after every check above is complete and repository release protections are active.

## Release rule

Do not enable value-bearing deposits or stakes until the V3 deployment validator and smoke paths pass, application production environment points to the validated V3 address, hosted database migrations are current at schema 21, replacement integration credentials are issued, exact-head Preview validation passes, and repository release protections/CI gates are active.
