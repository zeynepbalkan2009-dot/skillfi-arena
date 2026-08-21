import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { formatUsdcUnits, getPublicEnv, parseUsdcUnits } from "../lib/env/public.ts";

const root = process.cwd();

function withEnv<T>(patch: Record<string, string | undefined>, fn: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(patch)) {
    previous.set(key, process.env[key]);
    if (patch[key] === undefined) delete process.env[key];
    else process.env[key] = patch[key];
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("USDC helpers use 6-decimal integer units", () => {
  assert.equal(parseUsdcUnits("1").toString(), "1000000");
  assert.equal(parseUsdcUnits("1.234567").toString(), "1234567");
  assert.equal(formatUsdcUnits("1234567"), "1.234567");
  assert.throws(() => parseUsdcUnits("1.2345678"), /6 decimal/);
  assert.throws(() => parseUsdcUnits("-1"), /6 decimal/);
});

test("public env validation fails on missing public variables", () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined }, () => {
    assert.throws(() => getPublicEnv(), /Missing NEXT_PUBLIC_SUPABASE_URL/);
  });
});

test("server env validation declares required server-only variables", () => {
  const source = readFileSync(join(root, "lib/env/server.ts"), "utf8");
  assert.match(source, /PRIVY_APP_SECRET: string/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY: string/);
  assert.match(source, /OPERATOR_WALLET_ADDRESS: `0x\$\{string\}`/);
  assert.match(source, /Missing \$\{name\}\. Set it in \.env\.local or your deployment secrets\./);
});

test("invitation tokens are random and stored by hash", () => {
  const source = readFileSync(join(root, "lib/challenges/tokens.ts"), "utf8");
  assert.match(source, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(source, /createHash\("sha256"\)/);

  const first = randomBytes(32).toString("base64url");
  const second = randomBytes(32).toString("base64url");
  const firstHash = createHash("sha256").update(first, "utf8").digest("hex");
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(firstHash.length, 64);
  assert.notEqual(firstHash, first);
});

test("browser-facing source does not import server env or service-role keys", () => {
  const files = [
    "components/CreateChallengeModal.tsx",
    "components/ChallengeInviteClient.tsx",
    "components/ProfileClient.tsx",
    "components/LobbyClient.tsx",
    "lib/env/public.ts",
  ];

  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|PRIVY_APP_SECRET|OPERATOR_WALLET_ADDRESS/);
    assert.doesNotMatch(source, /@\/lib\/env\/server|@\/lib\/supabaseAdmin/);
  }
});

test("challenge migration stores safe invitation representation and has atomic acceptance guards", () => {
  const sql = readFileSync(join(root, "03_two_player_challenge_flow.sql"), "utf8");
  assert.match(sql, /invitation_token_hash text NOT NULL UNIQUE/);
  assert.doesNotMatch(sql, /invitation_token text NOT NULL/);
  assert.doesNotMatch(sql, /invitation_url text/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /v_challenge\.status <> 'open'/);
  assert.match(sql, /v_challenge\.expires_at <= now\(\)/);
  assert.match(sql, /v_challenge\.creator_id = p_player_id/);
  assert.match(sql, /v_challenge\.invited_opponent_id IS DISTINCT FROM p_player_id/);
  assert.match(sql, /ON CONFLICT ON CONSTRAINT match_participants_pkey DO NOTHING/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.accept_challenge\(uuid, uuid\) TO service_role/);
});

test("accept route requires invitation token before RPC acceptance", () => {
  const source = readFileSync(join(root, "app/api/challenges/[id]/accept/route.ts"), "utf8");
  assert.match(source, /getCurrentProfile/);
  assert.match(source, /invitationToken/);
  assert.match(source, /hashInvitationToken/);
  assert.match(source, /accept_challenge/);
  assert.ok(source.indexOf("hashInvitationToken") < source.indexOf("accept_challenge"));
});
