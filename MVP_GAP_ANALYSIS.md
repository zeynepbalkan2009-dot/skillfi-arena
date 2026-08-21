# MVP Gap Analysis

## Current MVP Readiness

The repository now has a buildable first product slice:

- Privy-authenticated profile sync.
- Editable public profile page.
- Off-chain challenge creation.
- Secure invitation URL model.
- Invitation detail and acceptance flow.
- Atomic database acceptance RPC.
- Lobby rendering for open and accepted challenges.
- Web3 baseline preserved at 48 passing tests.

This is not yet a full production Web3 esports MVP because escrow deposits, gameplay, result verification, settlement, payout, dispute operations, and audit/history workflows are still deferred.

## Capability Matrix

| Capability | Status | Gap |
| --- | --- | --- |
| Public lobby | Implemented for open/accepted off-chain challenges | Needs richer filtering and pagination |
| Privy login | Implemented | Needs production Privy credentials |
| Profile sync | Implemented | Needs live Supabase migration applied |
| Public profile editing | Implemented | Needs avatar validation/storage policy |
| Challenge creation | Implemented off-chain | Escrow deposit intentionally deferred |
| Invitation security | Implemented hash-only storage | Needs live DB validation against Supabase |
| Challenge acceptance | Implemented through RPC | Needs live concurrent DB test |
| Canonical match record | Implemented in RPC | Needs downstream match detail page |
| Web3 contracts | Tested | Not integrated into UI for deposits |
| Settlement/payout | Deferred | Requires next product sprint |
| Audit/transactions | Deferred | Required before money movement |
| Admin/operator tools | Deferred | Required before settlement operations |

## Highest Remaining Gaps

1. Apply the SkillFi schema/migrations to the dedicated Supabase development project.
2. Run HTTP API integration tests against the migrated Supabase dev project.
3. Confirm PostgREST column-level grants with real anon/authenticated Supabase keys.
4. Align the next sprint's deposit flow with `SkillFiEscrowV2`.
5. Add transaction/audit records before any irreversible financial action.
6. Build match detail and post-acceptance lifecycle screens.
7. Add risk-limit enforcement before accepting stakes.
