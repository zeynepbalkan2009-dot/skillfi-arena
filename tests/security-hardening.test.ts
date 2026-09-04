import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("participant result authority cannot bypass studio integration results", () => {
  const route = read("app/api/matches/result/route.ts");
  assert.match(route, /if \(!isPilotGameId\(gameSlug\)\)/);
  assert.match(route, /authoritative integration results are required/);
  assert.match(route, /from\("match_submissions"\)\.insert/);
  assert.doesNotMatch(route, /from\("match_submissions"\)\.upsert/);
  assert.match(route, /Result already submitted for this match/);
});

test("join confirmation is bound to the exact escrow transaction and PlayerJoined event", () => {
  const route = read("app/api/matches/join/route.ts");
  assert.match(route, /receipt\.to/);
  assert.match(route, /getAddress\(receipt\.to\) !== getAddress\(ESCROW_CONTRACT_ADDRESS\)/);
  assert.match(route, /eventName: "PlayerJoined"/);
  assert.match(route, /log\.args\.matchId === matchId/);
  assert.match(route, /getAddress\(log\.args\.player\) === caller/);
});

test("escrow v3 binds the creator before deposits and rejects first-join front-running", () => {
  const contract = read("web3/contracts/SkillFiEscrowV3.sol");
  const createRoute = read("app/api/matches/create/route.ts");
  const joinRoute = read("app/api/matches/join/route.ts");
  assert.match(contract, /function createMatch\(uint256 matchId, uint256 entryFee, address expectedPlayer1\)/);
  assert.match(contract, /player1: expectedPlayer1/);
  assert.match(contract, /require\(msg\.sender == m\.player1, "not creator"\)/);
  assert.match(createRoute, /args: \[matchId, stake, creatorWallet\]/);
  assert.match(joinRoute, /On-chain creator does not match the database match creator/);
  assert.match(joinRoute, /A valid stake risk reservation is required before joining this match/);
  assert.match(joinRoute, /getStakeReservation\(`join:\$\{dbMatch\.id\}:\$\{user\.id\}`\)/);
});

test("escrow v3 snapshots economic and timeout policy before deposits", () => {
  const contract = read("web3/contracts/SkillFiEscrowV3.sol");
  const settlement = read("lib/settlement.ts");
  assert.match(contract, /feeBpsAtCreation: platformFeeBps/);
  assert.match(contract, /waitingTimeoutAtCreation: matchTimeout/);
  assert.match(contract, /readyGraceAtCreation: readyMatchGrace/);
  assert.match(contract, /activeTimeoutAtCreation: activeMatchTimeout/);
  assert.match(contract, /treasuryAtCreation: treasury/);
  assert.match(contract, /disputeTimeoutAtCreation: disputeTimeout/);
  assert.match(contract, /totalPrize \* m\.feeBpsAtCreation/);
  assert.match(contract, /safeTransfer\(m\.treasuryAtCreation, fee\)/);
  assert.match(settlement, /const feeBps = onchain\[9\]/);
  assert.doesNotMatch(settlement, /functionName: "platformFeeBps"/);
});

test("escrow v3 provides permissionless recovery for READY, active, and unresolved disputed matches", () => {
  const contract = read("web3/contracts/SkillFiEscrowV3.sol");
  assert.match(contract, /uint256 public readyMatchGrace = 10 minutes/);
  assert.match(contract, /uint256 public disputeTimeout = 7 days/);
  assert.match(contract, /function reclaimReadyMatch\(uint256 matchId\) external nonReentrant/);
  assert.match(contract, /function reclaimActiveMatch\(uint256 matchId\) external nonReentrant/);
  assert.match(contract, /function reclaimDisputedMatch\(uint256 matchId\) external nonReentrant/);
  assert.match(contract, /m\.createdAt \+ m\.waitingTimeoutAtCreation \+ m\.readyGraceAtCreation/);
  assert.match(contract, /m\.startedAt \+ m\.activeTimeoutAtCreation/);
  assert.match(contract, /m\.disputedAt \+ m\.disputeTimeoutAtCreation/);
  assert.match(contract, /require\(block\.timestamp <= m\.startedAt \+ m\.activeTimeoutAtCreation, "match expired"\)/);
  assert.match(contract, /function resolveDispute[\s\S]*?onlyRole\(ARBITER_ROLE\)[\s\S]*?nonReentrant/);
  const resolveDisputeBlock = contract.match(/function resolveDispute[\s\S]*?\n    }\n/)?.[0] ?? "";
  assert.ok(resolveDisputeBlock.length > 0);
  assert.doesNotMatch(resolveDisputeBlock, /whenNotPaused/);
  assert.match(contract, /m\.status == MatchStatus\.WAITING_FOR_PLAYERS \|\| m\.status == MatchStatus\.READY/);
  assert.doesNotMatch(contract, /m\.status != MatchStatus\.RESOLVED/);
});

test("settlement broadcasts are protected by a database single-writer lease", () => {
  const migration = read("supabase/18_settlement_single_writer.sql");
  const settlement = read("lib/settlement.ts");
  const health = read("app/api/health/route.ts");
  assert.match(migration, /create table if not exists public\.match_settlement_leases/);
  assert.match(migration, /claim_match_settlement/);
  assert.match(migration, /record_match_settlement_tx/);
  assert.match(migration, /grant execute on function public\.claim_match_settlement[^\n]* to service_role/);
  assert.match(settlement, /claimSettlementLease\(match\.id, leaseToken\)/);
  assert.match(settlement, /await recordSettlementLeaseTx\(match\.id, leaseToken, settlementHash\)/);
  assert.match(settlement, /throw new SettlementInProgressError\(\)/);
  assert.match(health, /EXPECTED_SCHEMA_VERSION = 20/);
});

test("published integration results reject a conflicting locked winner", () => {
  const route = read("app/api/integrations/v1/results/route.ts");
  assert.match(route, /match\.winner_id && match\.winner_id !== winner\.id/);
  assert.match(route, /Match already has a different authoritative winner/);
  assert.match(route, /Authoritative result conflicts with the locked match winner/);
});

test("studio listing fee uses explicit economic config and exact token event source", () => {
  const config = read("lib/studios.ts");
  const route = read("app/api/studios/fee/route.ts");
  assert.match(config, /STUDIO_LISTING_FEE_USDC/);
  assert.match(config, /STUDIO_FEE_TREASURY_ADDRESS/);
  assert.doesNotMatch(config, /OPERATOR_WALLET_ADDRESS/);
  assert.doesNotMatch(config, /\?\? "10"/);
  assert.match(route, /getAddress\(log\.address\) === getAddress\(USDC_TOKEN_ADDRESS\)/);
  assert.match(route, /Transaction predates this studio fee request/);
});

test("authenticated profile and one-time studio credentials are explicitly non-cacheable", () => {
  const profile = read("app/api/profile/route.ts");
  const credentials = read("app/api/studios/credentials/route.ts");
  assert.match(profile, /Cache-Control": "private, no-store, max-age=0/);
  assert.match(credentials, /Cache-Control": "private, no-store, max-age=0/);
  assert.match(credentials, /Pragma: "no-cache"/);
  assert.match(credentials, /secret: generated\.secret/);
});

test("challenge acceptance response does not return participant wallet fields", () => {
  const route = read("app/api/challenges/[id]/accept/route.ts");
  assert.doesNotMatch(route, /player_a:users![^\n]*wallet_address/);
  assert.doesNotMatch(route, /player_b:users![^\n]*wallet_address/);
  assert.match(route, /Challenge accepted but match could not be loaded/);
});

test("Vercel preview placeholders remain no-value and production-sensitive identities stay real", () => {
  const env = read("lib/env/public.ts");
  assert.match(env, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(env, /name === "NEXT_PUBLIC_ESCROW_ADDRESS"/);
  assert.match(env, /name === "NEXT_PUBLIC_USDC_TOKEN_ADDRESS"/);
  assert.match(env, /name === "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"/);
  const previewGuard = env.match(/function allowPreviewPlaceholder[\s\S]*?\n}\n/)?.[0] ?? "";
  assert.ok(previewGuard.length > 0);
  assert.doesNotMatch(previewGuard, /NEXT_PUBLIC_PRIVY_APP_ID|NEXT_PUBLIC_SUPABASE/);
  const escrow = read("lib/serverEscrow.ts");
  assert.match(escrow, /assertEscrowContractConfigured\(\)/);
});
