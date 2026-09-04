# SkillFi Arena — Deployment Readiness

## Security hardening status

The current production deployment still points at the legacy `SkillFiEscrowV2` contract. The security-hardening branch introduces `SkillFiEscrowV3`; do not promote this branch to production until V3 is deployed, validated, and the production environment points at the new address.

- Active target: Arc Testnet
- Canonical Arc USDC: `0x3600000000000000000000000000000000000000`
- Hosting project: linked to GitHub and deploying from `main`
- Public URL: `https://skillfi-arena.vercel.app`
- Required hosted schema version: `22`
- Required application Node line: `22.x`
- Required Next.js line: `15.5.25`
- Required escrow implementation: `SkillFiEscrowV3`
- Required critical identities: five distinct addresses — deployer, admin, operator, arbiter, and treasury
- New value-bearing exposure requires **two aligned gates**: application `SKILLFI_VALUE_BEARING_ENABLED=1` and on-chain V3 `depositsEnabled=true`
- V3 deploys with `depositsEnabled=false`; new deposits are closed by default

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
- `SKILLFI_VALUE_BEARING_ENABLED=1` **only during the coordinated final value-bearing activation**. Keep it unset or `0` during development, Preview, schema migration, V3 deployment, pre-activation production smoke tests, and any degraded/incident state.

The application switch blocks **new** staked match creation and join preflight when disabled. It intentionally does not block join confirmation, settlement, cancellation, dispute handling, or recovery paths, because switching application value mode off must never strand funds already deposited.

The following variables must not exist in hosted production or preview environments:

- `SKILLFI_TEST_PRIVY_TOKEN_MAP`
- `SKILLFI_TEST_PRIVY_USERS`

## Contract release gate

Before changing `NEXT_PUBLIC_ESCROW_ADDRESS`:

1. Deploy `SkillFiEscrowV3` using `web3/scripts/deploy-arc.ts` from a secure signer environment.
2. Use five distinct addresses for deployer, admin, operator, arbiter, and treasury. The contract and deployment tooling reject critical identity overlap.
3. Keep the persistent admin separate from the deployer. For value-bearing governance, use an appropriate controlled or multisig admin process rather than a shared hot key.
4. Confirm deployment completed with `depositsEnabled=false` and the manifest records `depositsEnabledAtDeployment: false`.
5. Run `ARC_EXPECT_DEPOSITS_ENABLED=0 npm run validate:arc-testnet` against the generated `web3/deployments/arc-testnet-v3.json`.
6. Confirm the runtime-code hash, canonical USDC address, role membership, treasury, fee policy, timeout policy, deposit state, and emergency pause state match the deployment manifest/expectation.
7. Keep on-chain deposits closed during database/application cutover and pre-activation validation.
8. Confirm the dedicated application operator has `OPERATOR_ROLE` and is not also admin, arbiter, or treasury.
9. If rotating an operator, provide `ARC_PREVIOUS_OPERATOR_ADDRESS`; verify the new operator before revoking the old role.
10. Record the V3 address in the deployment environment; never overwrite the historical V2 deployment record.

### Controlled admin / multisig actions

Do not export a production admin private key merely to toggle the release gate. Generate calldata without signing or broadcasting:

```shell
ARC_ESCROW_ADDRESS=0x... npm run admin:calldata -- enable-deposits
ARC_ESCROW_ADDRESS=0x... npm run admin:calldata -- disable-deposits
ARC_ESCROW_ADDRESS=0x... npm run admin:calldata -- pause
ARC_ESCROW_ADDRESS=0x... npm run admin:calldata -- unpause
```

The generated target/function/arguments/calldata must be independently checked and simulated in the configured `DEFAULT_ADMIN_ROLE` signer or multisig flow before execution.

`setDepositsEnabled(false)` is the normal on-chain kill switch for **new exposure**: it blocks `createMatch` and `joinMatch` but intentionally leaves already-funded match start, settlement, dispute, cancellation, and recovery semantics available. Full `pause()` is a stronger emergency brake: it also blocks match start, normal settlement, and new disputes. Cancellation/refund/reclaim functions and resolution of already-open disputes remain available while paused.

## Database release gate

Use the canonical hosted migration chain in `MIGRATION_ORDER.md`. Credential rotation is intentionally two-stage:

1. Apply migrations through `supabase/21_rotate_game_api_key_hashes.sql`. Schema 21 is non-destructive and keeps existing legacy credentials active while allowing new 12-hex/scrypt credentials to be created.
2. Create, securely distribute, and validate replacement credentials for every active integration before cutover.
3. During the coordinated cutover, apply `supabase/22_revoke_legacy_game_api_keys.sql`. Schema 22 revokes only legacy 8-character-prefix credentials and fails if any remains active.
4. Reload the PostgREST schema cache.

Required checks after cutover:

- `public.schema_release_state.version = 22`
- anonymous/authenticated access to `public.users` is column-scoped to public-safe profile fields
- direct public reads cannot enumerate `challenges`, `challenge_participants`, or `match_participants`
- public match reads expose only the intended projected columns
- `public.matches` is absent from the `supabase_realtime` publication
- `guilds` is accessible to the service role
- API rate-limit RPC is installed and sensitive rate-limit state remains service-role only
- risk idempotency hardening is installed
- settlement single-writer RPCs are installed and service-role only
- `HTTP Validation %` fixture games are inactive/suspended
- replacement studio integration credentials use the new 12-hex prefix + scrypt model
- no active legacy 8-character-prefix integration credential remains

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
- Confirm `/api/health` returns HTTP 200 with `status: ok` only after schema 22, V3/operator, studio economic configuration, test-auth state, and value-gate alignment are correct.
- Before final activation, `/api/health` should report `checks.valueBearing.applicationEnabled=false`, `checks.valueBearing.onchainDepositsEnabled=false`, and `checks.valueBearing.aligned=true`.
- After final activation, it should report both booleans `true` with `aligned=true`.

## GitHub / CI release gate

- `main` must have branch protection or an equivalent ruleset requiring PR review/status checks before value-bearing production release.
- Required checks should include the main CI, Live Match Type Check, CodeQL, and the relevant Vercel deployment check.
- Permanent GitHub Actions must remain pinned to immutable commit SHAs.
- Do not treat a green GitHub CI run as proof that Supabase migrations, V3 deployment, production environment values, or on-chain deposit state are current.

## Vercel Preview gate

- The Preview must correspond to the exact release commit SHA.
- A READY Preview from an earlier hardening commit is not sufficient.
- Inspect build logs to confirm Node 22 is actually used.
- Smoke-test the landing page and security-sensitive routes/headers.
- If Vercel reports `build-rate-limit`, let the platform limit clear or change account capacity; do not create meaningless commits merely to retrigger builds.

## Production promotion order

Coordinate this sequence so GitHub-to-Vercel automatic production deployment cannot expose a code/schema/contract mismatch and studio integrations are not needlessly interrupted.

1. Freeze the release head after exact-head GitHub CI, CodeQL, Live Match Type Check, and Preview validation are green.
2. Keep `SKILLFI_VALUE_BEARING_ENABLED` unset/`0`.
3. Deploy V3 with five distinct critical identities and verify `depositsEnabled=false` using `ARC_EXPECT_DEPOSITS_ENABLED=0 npm run validate:arc-testnet`.
4. Apply hosted migrations only through **schema 21**. This safely enables the new credential format without revoking existing keys.
5. Generate replacement 12-hex/scrypt credentials and securely distribute/validate them with every active studio integration while legacy keys remain active.
6. Before final cutover, ensure automatic production promotion is paused/controlled or use a coordinated maintenance window.
7. Apply **schema 22** to revoke only legacy credentials, then reload PostgREST schema cache.
8. Configure production environment values to the validated V3 escrow, dedicated operator, valid WalletConnect project ID, and required studio economic configuration. Ensure test-auth variables are absent and keep `SKILLFI_VALUE_BEARING_ENABLED=0`.
9. Merge/promote the exact validated application commit and switch studio integrations to the pre-staged replacement credentials.
10. Verify `/api/health`, authentication, lobby/match flows, integration authentication, recovery paths, CSP/HSTS/no-store headers, and runtime error logs while both value gates remain false/aligned.
11. Generate `enable-deposits` calldata and execute `setDepositsEnabled(true)` through the controlled admin/multisig only after independent target/chain/state verification and simulation.
12. Set `SKILLFI_VALUE_BEARING_ENABLED=1` as the coordinated application-side activation immediately around the same controlled maintenance step; do not leave one gate intentionally mismatched.
13. Run `ARC_EXPECT_DEPOSITS_ENABLED=1 npm run validate:arc-testnet` and require `/api/health` to report both gates true and aligned.
14. Run one controlled new-match create/deposit/join path, verify settlement/recovery behavior and runtime logs, then remove maintenance restrictions only if every invariant remains healthy.

## Incident rollback

For a normal incident where new exposure should stop but already-funded matches should remain serviceable:

1. Set `SKILLFI_VALUE_BEARING_ENABLED=0`.
2. Have the controlled admin/multisig execute `setDepositsEnabled(false)`.
3. Require `/api/health` to return to both gates false/aligned.
4. Preserve settlement/cancel/dispute/recovery operations for funded matches and investigate before reactivation.

Use full `pause()` only when the incident requires a stronger on-chain halt. Document the reason, simulate the recovery plan, and remember that pause blocks start/normal settlement/new disputes in addition to new exposure.

## Release rule

Do not enable value-bearing deposits or stakes until the V3 deployment validator and smoke paths pass with deposits closed, application production environment points to the validated V3 address, hosted database migrations are current at schema 22, legacy integration credentials are revoked only after replacement credentials are staged, exact-head Preview validation passes, repository release protections/CI gates are active, and the controlled admin/multisig plus application environment deliberately enable the two value-bearing gates with post-activation validation proving they are aligned.
