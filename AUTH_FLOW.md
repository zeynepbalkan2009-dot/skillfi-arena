# Auth Flow

SkillFi Arena uses Privy as the identity provider.

1. The client obtains a Privy access token with `usePrivy().getAccessToken()`.
2. Protected routes read `Authorization: Bearer <token>`.
3. `lib/privy.ts` verifies the token server-side.
4. `lib/auth/server.ts` derives the Privy DID, email, and primary EVM wallet from the verified Privy identity.
5. The app maps the DID to `public.users.privy_user_id`.
6. Server routes use `supabaseAdmin` for private writes.

Routes using this model:

- `POST /api/auth/sync`
- `GET /api/profile`
- `PATCH /api/profile`
- `POST /api/matches/create`
- `POST /api/challenges/[id]/accept`

The client never supplies trusted Privy DID, wallet ownership, wins, losses, ELO, earnings, or match counts. Profile PATCH only accepts username, display name, and avatar URL.
