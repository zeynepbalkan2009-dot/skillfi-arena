# SkillFi Arena Web3 Workspace

`web3/` is the canonical Hardhat workspace for SkillFi Arena smart contracts.

## Contracts

- `contracts/SkillFiEscrowV2.sol` - escrow lifecycle for operator-created matches, player deposits, operator settlement, arbiter dispute resolution, cancellation, expiry, and refunds.
- `contracts/MockUSDC.sol` - 6-decimal ERC20 test token used by local tests.

## Commands

```shell
npm install
npm run compile
npm run test
```

Deploy and verify scripts live in `scripts/`:

```shell
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat run scripts/verify.ts --network sepolia
```

## Arc Testnet

Arc Testnet is configured as the grant-target settlement network. The deployment uses Arc's canonical 6-decimal USDC ERC-20 interface at `0x3600000000000000000000000000000000000000`; it does not deploy a mock token. Arc's native gas balance is also USDC but is represented with 18 decimals, so gas values and ERC-20 settlement amounts must not be mixed.

```shell
cp .env.example .env
npm run compile
npm run test
npm run deploy:arc-testnet
npm run validate:arc-testnet
```

Before deployment, fund the dedicated Arc testnet deployer through the Circle Faucet. The deployment script refuses the wrong chain ID, a zero gas balance, missing canonical USDC bytecode, zero role addresses, and fees above 10%. It writes public deployment evidence to `deployments/arc-testnet.json`; never put the private key in that file or commit `.env`.

Copy `.env.example` to `.env` before using a live network. Never commit private keys or RPC secrets.

## Notes

- The old Counter sample contract, tests, scripts, and Ignition module were removed.
- Hardhat artifacts and cache are generated outputs. They can be deleted and regenerated with `npm run compile`.
- The frontend ABI/integration model is intentionally not expanded in this stabilization pass; product lifecycle work remains in `TODO.md`.
