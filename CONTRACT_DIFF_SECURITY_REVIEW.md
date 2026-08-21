# Contract Diff Security Review

## Scope

Reviewed `web3/contracts/SkillFiEscrowV2.sol` and `web3/contracts/MockUSDC.sol` after consolidation and stabilization changes.

## Public And External Function Changes

- `joinMatch(uint256)` now uses `SafeERC20.safeTransferFrom`.
- `resolveMatch(uint256,address)` now uses `SafeERC20.safeTransfer`.
- `resolveDispute(uint256,address)` now uses `SafeERC20.safeTransfer`, is `nonReentrant`, and sets status before transfers.
- `cancelMatch(uint256)` now rejects resolved, cancelled, and expired matches, sets `CANCELLED` before refund transfers, and remains operator-only.
- `refundExpiredMatch(uint256)` sets `EXPIRED` before refund transfers.
- `reclaimExpiredMatch(uint256)` was added as an explicit user-callable waiting-match expiry refund path.
- `reclaimActiveMatch(uint256)` was added as an explicit user-callable active-match timeout refund path.
- `MockUSDC.decimals()` now returns `6`.
- `MockUSDC.mint(address,uint256)` was added for deterministic test setup.

No public or external functions were removed from `SkillFiEscrowV2.sol`.

## State Variables

No storage variables were added or removed in `SkillFiEscrowV2.sol`.

The token type remains `IERC20 public immutable token`; transfer calls now use `SafeERC20`.

## Lifecycle Transitions

- `WAITING_FOR_PLAYERS -> READY` remains automatic after the second deposit.
- `READY -> IN_PROGRESS` remains operator-only through `startMatch`.
- `IN_PROGRESS -> RESOLVED` remains operator-only through `resolveMatch`.
- `IN_PROGRESS -> DISPUTED` remains participant-only through `disputeMatch`.
- `DISPUTED -> RESOLVED` remains arbiter-only through `resolveDispute`.
- `WAITING_FOR_PLAYERS -> EXPIRED` is available through `refundExpiredMatch` and `reclaimExpiredMatch` after timeout.
- `IN_PROGRESS -> EXPIRED` is available through `reclaimActiveMatch` after timeout.
- unresolved nonterminal matches can be cancelled by the operator through `cancelMatch`.

## Reclaim Rules

`reclaimExpiredMatch` applies only to `WAITING_FOR_PLAYERS` matches after `createdAt + matchTimeout`.

`reclaimActiveMatch` applies only to `IN_PROGRESS` matches after `createdAt + matchTimeout`.

Disputed matches cannot be reclaimed by either reclaim function in the current specification.

## Cancellation Rules

`cancelMatch` is operator-only and now rejects terminal states: `RESOLVED`, `CANCELLED`, and `EXPIRED`.

Because status is set to `CANCELLED` before refund transfers, a reentrant token cannot trigger a second cancellation/refund path.

## Disputes

Operator settlement is intentionally blocked while `DISPUTED`; only an address with `ARBITER_ROLE` can resolve the dispute.

Disputed matches do not expire through the reclaim helpers in this stabilization pass.

## Refund And Transfer Ordering

Refund and settlement paths now set terminal state before token transfers:

- `resolveMatch`: `RESOLVED` before prize and fee transfers.
- `resolveDispute`: `RESOLVED` before prize and fee transfers.
- `cancelMatch`: `CANCELLED` before `_refund`.
- `refundExpiredMatch`: `EXPIRED` before `_refund`.
- `reclaimExpiredMatch`: `EXPIRED` before `_refund`.
- `reclaimActiveMatch`: `EXPIRED` before `_refund`.

This reduces double-refund and reentrancy risk. External token operations use `SafeERC20`.

## Treasury Fee Behavior

The platform fee remains bounded by `setFee` at 10%. Settlement transfers exactly one fee to `treasury` when `fee > 0`, and duplicate settlement is rejected by terminal status.

## Roles And Pause

- `OPERATOR_ROLE`: create, start, resolve, cancel.
- `ARBITER_ROLE`: resolve disputes.
- `DEFAULT_ADMIN_ROLE`: set treasury, set fee, set timeout, pause, unpause, and grant roles.

Pause currently affects match creation, deposits, and disputes. It does not block operator/arbiter settlement or refund paths, which preserves the ability to unwind funds while paused.

## 6-Decimal USDC Assumptions

`MockUSDC` now uses 6 decimals and tests use `ethers.parseUnits(value, 6)`. Contract escrow math is integer-unit based and does not hardcode token decimals.

Frontend display/default parsing assumptions are tracked in `USDC_DECIMAL_AUDIT.md`.

## Added Invariant Coverage

The test suite now covers:

- contract balance equals unresolved deposits;
- resolved matches cannot be refunded or reclaimed;
- cancelled matches cannot be cancelled or refunded twice;
- expired matches cannot be reclaimed twice;
- disputed matches cannot be operator-resolved;
- disputed matches cannot be reclaimed;
- players cannot receive more than valid refund or prize;
- treasury receives exact fee once;
- failed ERC20 deposit transfer rolls back state;
- match IDs cannot be reused after terminal state.
