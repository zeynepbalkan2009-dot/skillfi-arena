# Web3 Consolidation Report

## Canonical Workspace

`web3/` is now the single source of truth for smart contracts, Hardhat config, scripts, tests, and Web3 package dependencies.

## Files Kept

- `web3/contracts/SkillFiEscrowV2.sol`
- `web3/contracts/MockUSDC.sol`
- `web3/test/SkillFiEscrowV2.ts`
- `web3/scripts/deploy.ts`
- `web3/scripts/verify.ts`
- `web3/hardhat.config.ts`
- `web3/package.json`
- `web3/package-lock.json`
- `web3/.env.example`

## Files Removed Or Replaced

- root `contracts/SkillFiEscrowV2.sol` moved to `web3/contracts/SkillFiEscrowV2.sol`;
- root `contracts/MockUSDC.sol` moved to `web3/contracts/MockUSDC.sol`;
- root `contracts/deploy.ts` moved to `web3/scripts/deploy.ts`;
- root `contracts/.env` moved to `web3/.env`;
- root `contracts/` removed after migration;
- sample `web3/contracts/Counter.sol` removed;
- sample `web3/contracts/Counter.t.sol` removed;
- sample `web3/test/Counter.ts` removed;
- sample `web3/ignition/modules/Counter.ts` removed;
- sample `web3/scripts/send-op-tx.ts` removed.

## Dependency Cleanup

- Removed unused direct `@nomicfoundation/hardhat-toolbox`.
- Removed unused direct `@nomicfoundation/hardhat-ignition`.
- Kept `@nomicfoundation/hardhat-toolbox-mocha-ethers` because it is the active Hardhat 3 testing plugin used by `hardhat.config.ts`.

## Commands

```shell
cd web3
npm install
npm run compile
npm run test
```

Clean compile currently reports no source changes when artifacts are present. After deleting `web3/artifacts` and `web3/cache`, it recompiles only `MockUSDC.sol` and `SkillFiEscrowV2.sol`.
