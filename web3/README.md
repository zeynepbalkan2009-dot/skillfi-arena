# SkillFi Arena Web3 Workspace

`web3/` is the canonical Hardhat workspace for SkillFi Arena smart contracts.

## Contracts

- `contracts/SkillFiEscrowV3.sol` - current release candidate. It binds the expected creator, snapshots fee/treasury/timeout policy before deposits, stores the canonical winner, provides bounded dispute/refund paths, and enforces separation between deployer, admin, operator, arbiter, and treasury identities.
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
npm run validate:base-sepolia
npm run smoke:base-sepolia
```

The deployment writes `deployments/base-sepolia-v3.json`. Validation checks the runtime-code hash, role separation, token/treasury configuration, policy timeouts, and release pause state.

## Arc Testnet

Arc Testnet is the grant-target settlement network. The deployment uses Arc's canonical 6-decimal USDC ERC-20 interface at `0x3600000000000000000000000000000000000000`; it does not deploy a mock token. Arc's native gas balance is also USDC but is represented with 18 decimals, so gas values and ERC-20 settlement amounts must not be mixed.

Set explicit and distinct `ARC_ADMIN_ADDRESS`, `ARC_OPERATOR_ADDRESS`, `ARC_ARBITER_ADDRESS`, and `ARC_TREASURY_ADDRESS`; the Arc deployer must be a fifth distinct address. For a value-bearing release, the admin should use an appropriate controlled governance identity (preferably a multisig) rather than a shared application/deployer hot key.

```shell
cp .env.example .env
npm run compile
npm run test
npm run deploy:arc-testnet
npm run validate:arc-testnet
npm run smoke:arc-testnet
npm run smoke:arc-safety
```

The Arc deployment script refuses the wrong chain ID, zero gas balance, missing canonical USDC bytecode, missing/overlapping role addresses, and fees above 10%. It writes public deployment evidence to `deployments/arc-testnet-v3.json`, including the runtime-code hash and locked policy defaults. Never put a private key in that file or commit `.env`.

Operator rotation is intentionally separate from deployment. `ARC_OPERATOR_VERIFY_ONLY=1` performs read-only verification. A testnet EOA rotation requires a separate `ARC_ADMIN_PRIVATE_KEY` matching `ARC_ADMIN_ADDRESS`, verifies the new operator, revokes the previous operator, and uses the deployer/funder only for gas funding. A production multisig admin should execute governance changes through its controlled signing process rather than by exporting a shared hot key.

## Source Verification

`web3/scripts/verify.ts` requires explicit token, admin, operator, arbiter, treasury, fee and escrow inputs and verifies `contracts/SkillFiEscrowV3.sol:SkillFiEscrowV3` with the six constructor arguments.

## Release Rule

Do not enable value-bearing deposits or stakes until the V3 deployment validator and smoke paths pass, application production environment points to the validated V3 address, hosted database migrations are current, and repository release protections/CI gates are active.
