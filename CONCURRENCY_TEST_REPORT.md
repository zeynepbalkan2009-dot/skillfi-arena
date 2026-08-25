# Concurrency Test Report

## Method

The harness used real parallel PostgreSQL client connections against `embedded-postgres`.

For each repetition:

1. Create one open challenge.
2. Create creator plus two eligible Player B candidates.
3. Submit two `accept_challenge(challenge_id, player_id)` calls simultaneously with `Promise.allSettled`.
4. Inspect challenge, match, challenge participant, and match participant rows.

## Repetition Count

10 real concurrent races.

## Result

- Successful acceptance calls: 10
- Controlled failed acceptance calls: 10
- Failure message for losing concurrent request: `challenge is not open`
- Every run had exactly one accepted opponent.
- Every run had exactly one canonical match.
- Every run had exactly two match participants.
- Every run had exactly two challenge participants.
- No duplicate participant rows were observed.

## Final Validation Database Counts

The concurrency database also includes failure-case fixtures:

- `users`: 51
- `games`: 17
- `matches`: 11
- `challenges`: 17
- `challenge_participants`: 28
- `match_participants`: 22

## Failure Cases

Verified against the real database:

- creator self-acceptance: `creator cannot accept own challenge`
- expired invitation: `challenge has expired`
- invalid invitation hash: zero matching rows
- revoked invitation: `challenge is not open`
- already-used invitation: `challenge is not open`
- wrong invited opponent: `challenge is invite-only`
- duplicate idempotency key: one challenge row
- missing user: `player not found`
- missing challenge: `challenge not found`
- already accepted challenge: `challenge is not open`
