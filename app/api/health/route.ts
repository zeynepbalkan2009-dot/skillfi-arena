import { NextResponse } from "next/server";
import { CHAIN_TARGET } from "@/lib/contracts";
import {
  ESCROW_CONTRACT_ADDRESS,
  escrowPublicClient,
  getOperatorAddress,
  skillFiEscrowAbi,
} from "@/lib/serverEscrow";
import { getStudioFeeConfig } from "@/lib/studios";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const EXPECTED_SCHEMA_VERSION = 21;

async function checkSettlementOperator() {
  try {
    const operator = getOperatorAddress();
    const role = await escrowPublicClient.readContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: skillFiEscrowAbi,
      functionName: "OPERATOR_ROLE",
    });
    return await escrowPublicClient.readContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: skillFiEscrowAbi,
      functionName: "hasRole",
      args: [role, operator],
    });
  } catch {
    return false;
  }
}

function checkStudioFeeConfig(): boolean {
  try {
    getStudioFeeConfig();
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const startedAt = Date.now();
  const [gamesResult, cohortResult, guildResult, schemaResult, settlementOperatorReady] = await Promise.all([
    supabaseAdmin
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("integration_status", "published")
      .in("slug", ["typing-sprint", "arithmetic-rush", "sequence-recall", "pattern-lock", "logic-grid"]),
    supabaseAdmin.from("beta_pilot_enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("guilds").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("schema_release_state").select("version").eq("id", 1).maybeSingle(),
    checkSettlementOperator(),
  ]);

  const databaseOk = !gamesResult.error && !cohortResult.error && !guildResult.error && !schemaResult.error;
  const pilotGamesReady = gamesResult.count === 5;
  const schemaReady = schemaResult.data?.version === EXPECTED_SCHEMA_VERSION;
  const studioFeeConfigReady = checkStudioFeeConfig();
  const testAuthDisabled = !process.env.SKILLFI_TEST_PRIVY_TOKEN_MAP && !process.env.SKILLFI_TEST_PRIVY_USERS;
  const status = databaseOk && pilotGamesReady && schemaReady && settlementOperatorReady && studioFeeConfigReady && testAuthDisabled
    ? "ok"
    : "degraded";

  return NextResponse.json({
    status,
    service: "skillfi-arena",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    chain: CHAIN_TARGET,
    checks: {
      database: databaseOk,
      schema: { ready: schemaReady, expected: EXPECTED_SCHEMA_VERSION, actual: schemaResult.data?.version ?? null },
      guilds: { accessible: !guildResult.error },
      pilotGames: { ready: pilotGamesReady, published: gamesResult.count ?? 0, expected: 5 },
      betaCohort: { active: cohortResult.count ?? 0, limit: 100 },
      settlementOperator: settlementOperatorReady,
      studioFeeConfig: studioFeeConfigReady,
      testAuthenticationDisabled: testAuthDisabled,
    },
    responseMs: Date.now() - startedAt,
    checkedAt: new Date().toISOString(),
  }, {
    status: status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
