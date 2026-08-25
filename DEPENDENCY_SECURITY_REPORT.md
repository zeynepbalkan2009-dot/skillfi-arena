# Dependency Security Report

## Scope

Reviewed root and Web3 dependency vulnerabilities with:

```shell
npm audit --json
cd web3
npm audit --json
npm audit fix
```

`npm audit fix` made no safe lockfile changes. Remaining fixes require either a major/breaking dependency path or an upstream Hardhat toolbox update.

## Safe Changes Applied

- Removed unused direct `@nomicfoundation/hardhat-toolbox`.
- Removed unused direct `@nomicfoundation/hardhat-ignition`.

`@nomicfoundation/hardhat-ignition` still appears transitively through `@nomicfoundation/hardhat-toolbox-mocha-ethers`.

## Remaining Vulnerabilities

Web3 audit total: 16 vulnerabilities.

- 9 low
- 5 moderate
- 2 high
- 0 critical

Root audit total: 42 vulnerabilities.

- 0 low
- 10 moderate
- 32 high
- 0 critical

## Classification

| Package | Severity | Direct | Dependency Type | Path | Project Exposure | Remediation |
| --- | --- | --- | --- | --- | --- | --- |
| `lodash-es` | high/moderate | transitive | dev | `@nomicfoundation/hardhat-toolbox-mocha-ethers -> @nomicfoundation/ignition-core` | Hardhat dev tooling only; not bundled into frontend or deployed contracts. Risk applies if untrusted templates/objects reach Ignition internals. | No non-breaking fix available through current toolbox path. Track upstream Hardhat toolbox release or replace toolbox plugin in a separate tooling task. |
| `serialize-javascript` | high/moderate | transitive | dev | `mocha` | Test runner only; not runtime product code. | `npm audit fix --force` proposes `mocha@11.3.0` despite current package declaring `^11.7.6`; npm still treats the remediation path as breaking. Deferred to avoid destabilizing Hardhat 3 toolbox integration. |
| `diff` | low | transitive | dev | `mocha -> diff` | Test runner patch parsing only. | Same Mocha remediation path as above; deferred. |
| `elliptic` | low | transitive | dev | `@nomicfoundation/hardhat-verify -> @ethersproject/*` | Hardhat verify/Ignition tooling only. | Requires upstream Hardhat/Ignition dependency update. |
| `@ethersproject/*` v5 packages | low | transitive | dev | `@nomicfoundation/hardhat-verify` | Hardhat verification tooling only. | Requires upstream Hardhat/Ignition dependency update. |
| `@nomicfoundation/hardhat-ignition`, `@nomicfoundation/hardhat-ignition-ethers`, `@nomicfoundation/ignition-core` | moderate | transitive | dev | `@nomicfoundation/hardhat-toolbox-mocha-ethers` | Dev tooling only; not imported by app/runtime. | No safe direct fix while keeping the active Hardhat 3 toolbox plugin. |
| `@nomicfoundation/hardhat-toolbox-mocha-ethers` | moderate | direct | dev | active Hardhat plugin | Needed for current tests/assertions. | `fixAvailable: false`; defer until upstream releases a fixed toolbox. |

## Decision

No `--force` audit fix was applied.

For Web3, the remaining issues are development/test tooling, not deployed Solidity bytecode. The correct next step is an isolated Web3 tooling upgrade task once Hardhat's toolbox dependency chain has a non-breaking fixed path.

For the root app, the remaining findings are mostly in the Next/Privy/Wagmi/Viem wallet stack. `npm audit` reports no safe non-breaking fix for the Privy/Wagmi/Viem chain and proposes major Next/eslint-config-next upgrades for several Next-related advisories. Those are deferred to a separate framework/SDK upgrade task because this stabilization task must not change product behavior or framework major versions.
