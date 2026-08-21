# API

## `POST /api/auth/sync`

Headers: `Authorization: Bearer <Privy access token>`.

Body for first-time profile creation:

```json
{ "username": "player_one", "region": "EU" }
```

Returns `{ "user": PlayerProfile }`.

## `GET /api/profile`

Returns the verified caller's public profile.

## `PATCH /api/profile`

Editable fields only:

```json
{ "username": "player_one", "displayName": "Player One", "avatarUrl": "https://..." }
```

Wallet, Privy DID, stats, ELO, earnings, and match counts are not accepted from the client.

## `POST /api/matches/create`

Creates an off-chain challenge.

```json
{
  "gameId": "uuid",
  "entryFee": "10.00",
  "currency": "USDC",
  "opponentMode": "open",
  "rules": "Best of 1",
  "expirationMinutes": 60,
  "idempotencyKey": "client-generated-uuid"
}
```

Returns `{ "challenge": Challenge }` with response-only `invitation_url`.

## `POST /api/challenges/[id]/accept`

Accepts a challenge with both the public challenge id and raw invitation token.

```json
{ "invitationToken": "raw-url-token" }
```

Returns `{ "match": MatchWithRelations }`.

## Supabase Integration Validation Status

The routes above build and pass local product/database tests, but they have not yet completed HTTP validation against Supabase PostgREST/Auth/RPC. The dedicated development project is reachable, but it is not migrated yet: PostgREST could not find `public.games`.
