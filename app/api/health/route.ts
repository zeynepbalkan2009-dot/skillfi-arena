import { NextResponse } from "next/server";
import { CHAIN_TARGET } from "@/lib/contracts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const [gamesResult, cohortResult] = await Promise.all([
    supabaseAdmin.from("games").select("id", { count: "exact", head: true }).eq("is_active", true).eq("integration_status", "published").in("slug", ["typing-sprint", "arithmetic-rush", "sequence-recall", "pattern-lock", "logic-grid"]),
    supabaseAdmin.from("beta_pilot_enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  const databaseOk = !gamesResult.error && !cohortResult.error;
  const pilotGamesReady = gamesResult.count === 5;
  const status = databaseOk && pilotGamesReady ? "ok" : "degraded";
  return NextResponse.json({
    status,
    service: "skillfi-arena",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    chain: CHAIN_TARGET,
    checks: {
      database: databaseOk,
      pilotGames: { ready: pilotGamesReady, published: gamesResult.count ?? 0, expected: 5 },
      betaCohort: { active: cohortResult.count ?? 0, limit: 100 },
    },
    responseMs: Date.now() - startedAt,
    checkedAt: new Date().toISOString(),
  }, { status: status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store, max-age=0" } });
}
