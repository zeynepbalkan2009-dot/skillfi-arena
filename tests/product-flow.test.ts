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

test("settlement validates winner and on-chain participants before payout", () => {
  const source = readFileSync(join(root, "lib/settlement.ts"), "utf8");
  assert.match(source, /winnerId !== match\.player_a_id && winnerId !== match\.player_b_id/);
  assert.match(source, /On-chain participants do not match the database/);
  assert.match(source, /Winner wallet is not an on-chain participant/);
  assert.ok(source.indexOf("On-chain participants do not match") < source.indexOf("resolveMatch"));
});

test("settlement reconciliation is participant-authorized and recoverable", () => {
  const route = readFileSync(join(root, "app/api/matches/settlement/reconcile/route.ts"), "utf8");
  const service = readFileSync(join(root, "lib/settlement.ts"), "utf8");
  assert.match(route, /getCurrentProfile/);
  assert.match(route, /Not a participant/);
  assert.match(route, /match\.status !== "settling" && match\.status !== "completed"/);
  assert.match(service, /A concurrent retry may have settled the contract first/);
  assert.match(service, /Number\(onchain\[6\]\) !== 4/);
  assert.match(service, /from\("transactions"\)\.upsert/);
  assert.match(service, /kind: "settlement"/);
  assert.match(service, /eventType: "settlement_broadcast"/);
  assert.match(service, /eventType: "settlement_confirmed"/);
  assert.match(service, /eventType: "match_completed"/);
});

test("match cancellation is creator-authorized, refund-audited, and releases risk reservations", () => {
  const route = readFileSync(join(root, "app/api/matches/cancel/route.ts"), "utf8");
  const button = readFileSync(join(root, "components/CancelMatchButton.tsx"), "utf8");
  const migration = readFileSync(join(root, "supabase/06_transaction_event_identity.sql"), "utf8");
  assert.match(route, /Only the match creator can cancel/);
  assert.match(route, /\["waiting_on_chain", "searching", "cancelled"\]/);
  assert.match(route, /functionName: "cancelMatch"/);
  assert.match(route, /kind: "refund"/);
  assert.match(route, /releaseMatchStakeReservations/);
  assert.match(route, /eventType: "match_cancelled"/);
  assert.match(button, /Cancel & refund/);
  assert.match(button, /Confirm refund/);
  assert.match(button, /getAccessToken/);
  const lobby = readFileSync(join(root, "components/LobbyClient.tsx"), "utf8");
  assert.match(lobby, /match\.status === "waiting_on_chain"/);
  assert.match(lobby, /player_a_id === currentUser\.id/);
  assert.match(migration, /unique \(tx_hash, kind, user_id\)/i);
});

test("dispute indexing verifies participant wallet, escrow target, event, and chain state", () => {
  const route = readFileSync(join(root, "app/api/matches/dispute/route.ts"), "utf8");
  const migration = readFileSync(join(root, "supabase/07_match_disputes.sql"), "utf8");
  assert.match(route, /Not a participant/);
  assert.match(route, /receipt\.to/);
  assert.match(route, /receipt\.from/);
  assert.match(route, /eventName: "MatchDisputed"/);
  assert.match(route, /Number\(onchain\[6\]\) !== 5/);
  assert.match(route, /eventType: "match_disputed"/);
  assert.match(route, /Dispute reason must be between 10 and 500 characters/);
  assert.match(route, /payload: \{ smartContractMatchId: match\.smart_contract_match_id, reason \}/);
  assert.match(migration, /'disputed'/);
  const resultRoute = readFileSync(join(root, "app/api/matches/result/route.ts"), "utf8");
  assert.match(resultRoute, /MatchDisputedError/);
  assert.match(resultRoute, /status: "disputed"/);
  const arbiterTool = readFileSync(join(root, "scripts/resolve-dispute.mjs"), "utf8");
  assert.match(arbiterTool, /Winner must be a match participant/);
  assert.match(arbiterTool, /ARBITER_ROLE/);
  assert.match(arbiterTool, /functionName: "resolveDispute"/);
  assert.match(arbiterTool, /findResolution/);
  assert.match(arbiterTool, /dispute_resolution_broadcast/);
  assert.match(arbiterTool, /On-chain winner is/);
  assert.match(arbiterTool, /kind: "settlement"/);
  assert.match(arbiterTool, /event_type: "dispute_resolved"/);
  const disputeQueue = readFileSync(join(root, "scripts/list-disputes.mjs"), "utf8");
  assert.match(disputeQueue, /\.eq\("status", "disputed"\)/);
  assert.match(disputeQueue, /wallet_address/);
  const matchDetail = readFileSync(join(root, "app/matches/[id]/page.tsx"), "utf8");
  assert.match(matchDetail, /disputed: "Under review"/);
  assert.match(matchDetail, /Automatic settlement is paused/);
  const profile = readFileSync(join(root, "components/ProfileClient.tsx"), "utf8");
  assert.match(profile, /disputedMatches/);
  assert.match(profile, /No additional wallet action is required/);
  assert.match(profile, /event\.payload\?\.reason/);
  const liveMatch = readFileSync(join(root, "components/LiveMatchClient.tsx"), "utf8");
  assert.match(liveMatch, /What went wrong\?/);
  assert.match(liveMatch, /Confirm dispute/);
});

test("studio onboarding separates listing fees from match escrow", () => {
  const migration = readFileSync(join(root, "supabase/08_studio_game_onboarding.sql"), "utf8");
  const studioRoute = readFileSync(join(root, "app/api/studios/route.ts"), "utf8");
  const gameRoute = readFileSync(join(root, "app/api/studios/games/route.ts"), "utf8");
  const feeRoute = readFileSync(join(root, "app/api/studios/fee/route.ts"), "utf8");
  const portal = readFileSync(join(root, "components/StudioPortalClient.tsx"), "utf8");
  const reviewPortal = readFileSync(join(root, "components/StudioReviewClient.tsx"), "utf8");
  assert.match(migration, /create table if not exists public\.studios/);
  assert.match(migration, /create table if not exists public\.studio_fee_payments/);
  assert.match(migration, /integration_status = 'published'/);
  assert.match(studioRoute, /owner_user_id: user\.id/);
  assert.match(gameRoute, /integration_status: "draft"/);
  assert.match(gameRoute, /is_active: false/);
  assert.match(feeRoute, /Only the studio owner can pay/);
  assert.match(feeRoute, /Transaction sender does not match the authenticated wallet/);
  assert.match(feeRoute, /exact listing fee was not transferred/);
  assert.match(feeRoute, /studio_fee_payments/);
  assert.doesNotMatch(feeRoute, /ESCROW_CONTRACT_ADDRESS/);
  assert.match(portal, /Testnet listing payment is separate from player stakes and match escrow/);
  const adminRoute = readFileSync(join(root, "app/api/admin/studios/route.ts"), "utf8");
  const adminGuard = readFileSync(join(root, "lib/studioAdmin.ts"), "utf8");
  assert.match(migration, /studio_audit_events/);
  assert.match(migration, /studio audit events are immutable/);
  assert.match(adminGuard, /STUDIO_ADMIN_USER_IDS/);
  assert.match(adminGuard, /OPERATOR_WALLET_ADDRESS/);
  assert.match(adminRoute, /Approve the studio before publishing its game/);
  assert.match(adminRoute, /Move the game through sandbox before publishing/);
  assert.match(adminRoute, /credential\.scopes\.includes\("results:write"\)/);
  assert.match(adminRoute, /Complete at least one accepted sandbox result before publishing/);
  assert.match(adminRoute, /Could not retire sandbox credentials/);
  assert.match(adminRoute, /revokedSandboxCredentialCount/);
  assert.match(adminRoute, /readyToPublish: hasActiveResultsCredential && acceptedResultCount > 0/);
  assert.match(adminRoute, /A review note of at least 3 characters is required/);
  assert.match(studioRoute, /Could not load review feedback/);
  assert.match(portal, /Review feedback:/);
  assert.match(reviewPortal, /Review note \(required to reject\)/);
  assert.match(portal, /Result submissions/);
  assert.match(adminRoute, /is_active: body\.decision === "published"/);
  assert.match(gameRoute, /Pay the listing fee before submitting a game/);
  assert.match(gameRoute, /eventType: "game_submitted"/);
  assert.match(gameRoute, /export async function PUT/);
  assert.match(gameRoute, /\["draft", "rejected"\]/);
  assert.match(gameRoute, /eventType: "game_draft_updated"/);
  assert.match(portal, /Edit draft/);
  assert.match(portal, /Save changes/);
  const credentialService = readFileSync(join(root, "lib/gameCredentials.ts"), "utf8");
  const credentialAdmin = readFileSync(join(root, "app/api/admin/studios/credentials/route.ts"), "utf8");
  const credentialOwner = readFileSync(join(root, "app/api/studios/credentials/route.ts"), "utf8");
  const integrationGame = readFileSync(join(root, "app/api/integrations/v1/game/route.ts"), "utf8");
  assert.match(migration, /create table if not exists public\.game_api_credentials/);
  assert.match(migration, /secret_hash text not null unique/);
  assert.doesNotMatch(migration, /secret text/);
  assert.match(credentialService, /createHash\("sha256"\)/);
  assert.match(credentialService, /randomBytes\(32\)/);
  assert.match(credentialService, /revoked_at/);
  assert.match(credentialService, /expires_at/);
  assert.match(credentialAdmin, /Copy this key now\. It will not be shown again\./);
  assert.match(credentialAdmin, /Credentials require a sandbox or published studio game/);
  const credentialOwnerGet = credentialOwner.slice(0, credentialOwner.indexOf("export async function POST"));
  assert.doesNotMatch(credentialOwnerGet, /secret_hash|secret:/);
  assert.match(credentialOwner, /\.eq\("owner_user_id", user\.id\)/);
  assert.match(credentialOwner, /\.eq\("studio_id", studio\.id\)/);
  assert.match(credentialOwner, /Copy this key now\. It will not be shown again\./);
  assert.match(credentialOwner, /game_credential_revoked/);
  assert.match(integrationGame, /authenticateGameApiKey/);
  assert.match(integrationGame, /"game:read"/);
  assert.match(integrationGame, /Published games require a live integration key/);
  const integrationResult = readFileSync(join(root, "app/api/integrations/v1/results/route.ts"), "utf8");
  const studioResults = readFileSync(join(root, "app/api/studios/results/route.ts"), "utf8");
  const integrationDocs = readFileSync(join(root, "INTEGRATION_API.md"), "utf8");
  assert.match(migration, /create table if not exists public\.game_result_submissions/);
  assert.match(migration, /constraint game_result_event_unique unique \(game_id, event_id\)/);
  assert.match(migration, /match_id uuid not null unique/);
  assert.match(credentialService, /createHmac\("sha256"/);
  assert.match(credentialService, /timingSafeEqual/);
  assert.match(credentialService, /5 \* 60 \* 1000/);
  assert.match(integrationResult, /"results:write"/);
  assert.match(integrationResult, /game\.integration_status === "sandbox" && !match\.smart_contract_match_id/);
  assert.match(integrationResult, /Published game results require an on-chain match/);
  assert.match(integrationResult, /Published games require a live integration key/);
  assert.match(integrationResult, /Buffer\.byteLength\(rawBody, "utf8"\) > 16_384/);
  assert.match(integrationResult, /status: 413/);
  assert.match(integrationResult, /eventType: "sandbox_match_completed"/);
  assert.match(studioResults, /eq\("owner_user_id", user\.id\)/);
  assert.match(studioResults, /eq\("studio_id", studio\.id\)/);
  assert.match(studioResults, /limit\(50\)/);
  assert.match(integrationResult, /Credential cannot submit results for this game/);
  assert.match(integrationResult, /Winner wallet is not a match participant/);
  assert.match(integrationResult, /external_result_accepted/);
  assert.match(integrationResult, /settleAndReconcileMatch/);
  assert.match(integrationDocs, /exact raw JSON body/);
  assert.match(portal, /Create integration key/);
  assert.match(portal, /Copy your new key now/);
  assert.match(portal, /Confirm revoke/);
});
