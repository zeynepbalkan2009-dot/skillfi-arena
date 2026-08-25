# HTTP Concurrency Test Report

## Status

Blocked before HTTP concurrency execution.

The prior raw PostgreSQL test validated real concurrent `accept_challenge()` calls directly against PostgreSQL. This sprint requires HTTP concurrency through:

Next.js route -> Supabase RPC -> PostgreSQL lock/transaction

The dedicated Supabase development project is reachable and required tables are visible for read checks, but the configured `SUPABASE_SERVICE_ROLE_KEY` is a publishable key class rather than a service-role key class. Server-side seed/write operations cannot proceed.

The `accept_challenge` RPC also failed the PostgREST preflight visibility check.

## Required Test When Supabase Is Available

For at least 10 repetitions:

1. Start the Next.js app with non-production Supabase env vars.
2. Create one challenge over `POST /api/matches/create`.
3. Send two parallel `POST /api/challenges/[id]/accept` requests using two eligible players.
4. Verify exactly one 2xx response and exactly one 409 response.
5. Query Supabase to confirm:
   - one accepted opponent
   - one canonical match
   - exactly two match participants
   - exactly two challenge participants
   - invitation cannot be reused
   - no duplicate or partial writes

## Current Counts

HTTP repetitions: 0

Successful HTTP acceptances: 0

HTTP conflicts: 0

Reason: invalid service-role credential for server-side writes, plus RPC visibility must be refreshed or corrected before HTTP acceptance can be tested.
