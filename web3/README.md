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

Copy `.env.example` to `.env` before using a live network. Never commit private keys or RPC secrets.

## Notes

- The old Counter sample contract, tests, scripts, and Ignition module were removed.
- Hardhat artifacts and cache are generated outputs. They can be deleted and regenerated with `npm run compile`.
- The frontend ABI/integration model is intentionally not expanded in this stabilization pass; product lifecycle work remains in `TODO.md`.
