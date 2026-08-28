# SkillFi Game Server Integration

Studio integrations use per-game API keys. The plaintext key is shown once; SkillFi stores only its SHA-256 hash. Keys are scoped, expirable, revocable, and available only after a game reaches `sandbox` or `published` status.

## Connection check

`GET /api/integrations/v1/game` with `Authorization: Bearer <key>` requires `game:read` and returns the game bound to the credential.

## Result submission

`POST /api/integrations/v1/results` requires `results:write`. Send the exact JSON body below:

```json
{
  "eventId": "your-unique-result-id",
  "matchId": "skillfi-match-uuid",
  "winnerWallet": "0x...",
  "occurredAt": "2026-08-28T12:00:00.000Z"
}
```

Add these headers:

- `Authorization: Bearer <key>`
- `Content-Type: application/json`
- `X-SkillFi-Timestamp: <current Unix milliseconds>`
- `X-SkillFi-Signature: <hex HMAC-SHA256>`

Calculate the signature over `<timestamp>.<exact raw JSON body>` using the API key as the HMAC secret. Requests outside a five-minute timestamp window are rejected. `eventId` is unique per game and each SkillFi match accepts only one external result, so retries with identical bytes are safe while conflicting replays are rejected.

The winner wallet must belong to one of the two match participants. The credential must belong to the match's game. Accepted results are stored before settlement and recorded in the immutable match audit trail.

