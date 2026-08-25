# Invitation Security

The invitation URL is an authorization-bearing link for challenge acceptance.

## Model

- Tokens are generated with `randomBytes(32).toString("base64url")`.
- The database stores only `sha256(token)` in `challenges.invitation_token_hash`.
- The raw token is returned once in the create response as `invitation_url`.
- The invitation page hashes the URL token to look up the challenge.
- The accept route requires both the challenge id and the raw token.

## Server-Side Enforcement

`accept_challenge` enforces:

- challenge exists
- status is still `open`
- challenge is not expired
- acceptor is not creator
- invite-only challenge is accepted only by the invited user
- match is created exactly once
- participant rows are idempotent

Accepted or expired invitations cannot be reused because the RPC rejects non-open status and marks expired challenges.

## Data Exposure

Invitation pages select public profile fields only. Service-role keys, risk profiles, Privy secrets, and private wallet ownership assertions are never sent to the browser.
