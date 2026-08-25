# RLS Security Report

## Environment

RLS checks were executed against real PostgreSQL roles created in the local validation cluster:

- `anon`
- `authenticated`
- `service_role`

## Results

| Check | Result |
| --- | --- |
| anon can read safe public challenge columns | Passed |
| anon cannot read `invitation_token_hash` | Passed |
| authenticated cannot edit another profile | Passed |
| authenticated cannot modify statistics | Passed |
| authenticated cannot assign wallet or Privy DID | Passed |
| authenticated cannot directly insert accepted matches | Passed |
| anon cannot bypass `accept_challenge` RPC | Passed |

## Notes

`03_two_player_challenge_flow.sql` now uses column-level grants on `public.challenges`. Public roles can select safe lobby/detail fields but cannot select `invitation_token_hash` or `idempotency_key`.

Writes remain service-route-only. The database RPC is executable by `service_role`, not by anon/authenticated clients.

## Supabase Follow-Up

These checks validate PostgreSQL RLS and grants directly.

Supabase PostgREST behavior is still unvalidated because no Supabase local stack or development project credentials are available in the current environment. Before production deployment, verify with real anon/authenticated Supabase clients:

- allowed public challenge columns remain readable
- `invitation_token_hash` is rejected
- `idempotency_key` is rejected
- profile/stat/wallet/Privy DID writes are rejected
- direct match and participant mutations are rejected
