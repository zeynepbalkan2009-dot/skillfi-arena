# Challenge Flow

This sprint implements off-chain challenge creation and acceptance only. USDC approval, escrow deposits, gameplay, settlement, and payout are deferred.

## Visible Flow

1. Player A logs in through Privy.
2. `AuthSync` calls `/api/auth/sync` and creates or loads a SkillFi profile.
3. Player A opens the lobby and creates a challenge.
4. `/api/matches/create` validates auth, game, USDC amount, opponent mode, expiry, and idempotency.
5. The server creates a `challenges` row and returns a one-time invitation URL containing the raw token.
6. Player B opens `/challenge/[token]`.
7. The page hashes the token and loads public challenge details.
8. Player B logs in and completes profile onboarding if required.
9. Player B accepts the challenge.
10. `/api/challenges/[id]/accept` verifies auth, validates the token hash, and calls `accept_challenge`.
11. The RPC locks the challenge row, creates or reuses one canonical match, adds participants, and transitions the challenge to `accepted`.
12. Lobby realtime updates show the accepted challenge state.

## Concurrency

Acceptance is guarded in the database by `SELECT ... FOR UPDATE` and a final `UPDATE ... WHERE status = 'open'`. Concurrent accept attempts serialize at the challenge row; one succeeds and later attempts receive a controlled conflict.
