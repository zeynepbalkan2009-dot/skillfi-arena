# SkillFi Arena Web3 Workspace

`web3/` is the canonical Hardhat workspace for SkillFi Arena smart contracts.

## Contracts

- `contracts/SkillFiEscrowV3.sol` - current release candidate. It binds the expected creator, snapshots fee/treasury/timeout policy before deposits, stores the canonical winner, provides bounded dispute/refund paths, enforces separation between deployer, admin, operator, arbiter, and treasury identities, and deploys with new deposits disabled by default.
- `contracts/SkillFiEscrowV2.sol` - historical testnet contract retained only for migration/reference coverage. Do not use it for new releases.
- `contracts/MockUSDC.sol` - 6-decimal ERC20 test token used by local/Base Sepolia tests.

## Local Validation

```shell
npm ci
npm run compile
npm run test
```

The repository CI also runs a production-dependency high/critical audit before contract compilation/tests.

## Base Sepolia

The Base Sepolia path deploys a mock USDC plus SkillFiEscrowV3. Set explicit and distinct `BASE_ADMIN_ADDRESS`, `BASE_OPERATOR_ADDRESS`, `BASE_ARBITER_ADDRESS`, and `BASE_TREASURY_ADDRESS`; the deployer must be a fifth distinct identity.

```shell
cp .env.example .env
npm run deploy:base-sepolia
BASE_EXPECT_DEPOSITS_ENABLED=0 npm run validate:base-sepolia
```

The deployment writes `deployments/base-sepolia-v3.json` and records `depositsEnabledAtDeployment: false`. Validation checks the runtime-code hash, role separation, token/treasury configuration, policy timeouts, emergency pause state, and the explicitly expected deposit-gate state.

Before running a value-bearing Base Sepolia smoke, the configured admin/multisig must deliberately enable deposits. The calldata encoder requires explicit network metadata for non-Arc targets:

```shell
ADMIN_TARGET_NETWORK=baseSepolia ESCROW_ADMIN_TARGET_ADDRESS=0x<base-v3-address> npm run admin:calldata -- enable-deposits
BASE_EXPECT_DEPOSITS_ENABLED=1 npm run validate:base-sepolia
npm run smoke:base-sepolia
```

The Base live smoke checks `depositsEnabled()` before funding temporary player wallets, so a closed gate fails clearly before spending testnet gas.

## Arc Testnet

Arc Testnet is the grant-target settlement network. The deployment uses Arc's canonical 6-decimal USDC ERC-20 interface at `0x3600000000000000000000000000000000000000`; it does not deploy a mock token. Arc's native gas balance is also USDC but is represented with 18 decimals, so gas values and ERC-20 settlement amounts must not be mixed.

Set explicit and distinct `ARC_ADMIN_ADDRESS`, `ARC_OPERATOR_ADDRESS`, `ARC_ARBITER_ADDRESS`, and `ARC_TREASURY_ADDRESS`; the Arc deployer must be a fifth distinct address. For a value-bearing release, the admin should use an appropriate controlled governance identity (preferably a multisig) rather than a shared application/deployer hot key.

```shell
cp .env.example .env
npm run compile
npm run test
npm run deploy:arc-testnet
ARC_EXPECT_DEPOSITS_ENABLED=0 npm run validate:arc-testnet
```

`SkillFiEscrowV3` deploys with `depositsEnabled=false`. The deployment is intentionally **not** ready to accept new entry-fee deposits immediately after deployment. Keep the application-side `SKILLFI_VALUE_BEARING_ENABLED` switch unset/`0` during deployment, migration, smoke tests, and production cutover.

The Arc deployment script refuses the wrong chain ID, zero gas balance, missing canonical USDC bytecode, missing/overlapping role addresses, fees above 10%, or an unexpectedly open deposit gate. It writes public deployment evidence to `deployments/arc-testnet-v3.json`, including the runtime-code hash, locked policy defaults, and `depositsEnabledAtDeployment: false`. Never put a private key in that file or commit `.env`.

### Admin / multisig activation

The repository does not require exporting the admin private key to activate or disable deposits. Generate calldata only, with target network and escrow address bound into the printed metadata:

```shell
ADMIN_TARGET_NETWORK=arcTestnet ESCROW_ADMIN_TARGET_ADDRESS=0x... npm run admin:calldata -- enable-deposits
ADMIN_TARGET_NETWORK=arcTestnet ESCROW_ADMIN_TARGET_ADDRESS=0x... npm run admin:calldata -- disable-deposits
ADMIN_TARGET_NETWORK=arcTestnet ESCROW_ADMIN_TARGET_ADDRESS=0x... npm run admin:calldata -- pause
ADMIN_TARGET_NETWORK=arcTestnet ESCROW_ADMIN_TARGET_ADDRESS=0x... npm run admin:calldata -- unpause
```

`admin:calldata` signs and broadcasts **nothing**. It prints the target network, chain ID, target address, action, function, arguments, and calldata so the configured `DEFAULT_ADMIN_ROLE` signer or multisig can independently verify, simulate, approve, and execute the transaction. `ADMIN_TARGET_NETWORK` accepts only `arcTestnet` or `baseSepolia`.

Final activation order:

1. Validate the deployed contract while deposits are closed: `ARC_EXPECT_DEPOSITS_ENABLED=0 npm run validate:arc-testnet`.
2. Complete schema 22, production environment, exact-head Preview, repository protection, and application smoke gates while `SKILLFI_VALUE_BEARING_ENABLED=0`.
3. Have the controlled admin/multisig execute `setDepositsEnabled(true)` using independently verified calldata.
4. Set `SKILLFI_VALUE_BEARING_ENABLED=1` in the application environment as the coordinated final application activation step.
5. Re-run `ARC_EXPECT_DEPOSITS_ENABLED=1 npm run validate:arc-testnet` and verify `/api/health` reports the application and on-chain gates aligned.

For a normal incident that should stop **new exposure** but preserve already-funded match progression, disable the application switch and execute `setDepositsEnabled(false)`. Use full `pause()` only for a stronger emergency: pausing also blocks new match creation/deposits, match start, normal settlement, and new disputes. Cancellation/refund/reclaim paths and resolution of already-open disputes remain available while paused.

Operator rotation is intentionally separate from deployment. `ARC_OPERATOR_VERIFY_ONLY=1` performs read-only verification. A testnet EOA rotation requires a separate `ARC_ADMIN_PRIVATE_KEY` matching `ARC_ADMIN_ADDRESS`, verifies the new operator, revokes the previous operator, and uses the deployer/funder only for gas funding. A production multisig admin should execute governance changes through its controlled signing process rather than by exporting a shared hot key.

## Source Verification

`web3/scripts/verify.ts` requires explicit token, admin, operator, arbiter, treasury, fee and escrow inputs and verifies `contracts/SkillFiEscrowV3.sol:SkillFiEscrowV3` with the six constructor arguments.

## Release Rule

Do not enable value-bearing deposits or stakes until V3 is validated with deposits closed, schema/application/repository gates pass, the controlled admin enables the on-chain deposit gate, the application switch is deliberately enabled, and the validator plus `/api/health` confirm both gates agree.
