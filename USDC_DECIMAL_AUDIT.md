# USDC Decimal Audit

## Scope

Searched active source and tests for:

- `parseEther`
- `formatEther`
- `ether`
- `10 ** 18`
- `1e18`
- hardcoded 18-decimal defaults
- `parseUnits` / `formatUnits`

Excluded generated outputs and dependencies.

## Findings

### Fixed

- `components/ChallengeCard.tsx`
  - Before: stake display defaulted to 18 decimals.
  - After: stake display defaults to 6 decimals to match MockUSDC/USDC base units when token metadata is not provided.

### Already Correct

- `components/CreateChallengeModal.tsx`
  - Reads `decimals()` from the configured ERC20 token.
  - Uses `parseUnits(stakeInput, decimals)` for the on-chain amount.

- `web3/test/SkillFiEscrowV2.ts`
  - Uses `ethers.parseUnits(..., 6)` for MockUSDC amounts.

- `web3/contracts/MockUSDC.sol`
  - `decimals()` returns `6`.
  - Constructor mints initial supply using `10 ** decimals()`, not a hardcoded 18.

### Not Changed

- `lib/contracts.ts`
  - The active chain native currency remains ETH with 18 decimals. This is not a USDC stake/token amount.

## Remaining Product Note

The UI still labels the token as `GNESS` because the existing product naming and environment variable are `NEXT_PUBLIC_GNESS_TOKEN_ADDRESS`. This stabilization pass aligned decimal math without renaming product token surfaces.
