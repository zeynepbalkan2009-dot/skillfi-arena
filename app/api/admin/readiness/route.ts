import { NextRequest, NextResponse } from "next/server";
import { keccak256, parseAbi, stringToBytes } from "viem";
import { getCurrentProfile } from "@/lib/auth/server";
import { isStudioAdmin } from "@/lib/studioAdmin";
import { ESCROW_CONTRACT_ADDRESS, escrowPublicClient, getOperatorAddress } from "@/lib/serverEscrow";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const accessControlAbi = parseAbi(["function hasRole(bytes32,address) view returns(bool)"]);
const arbiterRole = keccak256(stringToBytes("ARBITER_ROLE"));
const operatorRole = keccak256(stringToBytes("OPERATOR_ROLE"));

export async function GET(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user || !isStudioAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [games, activePlayers, disputes, studioReviews] = await Promise.all([
    supabaseAdmin.from("games").select("id", { count: "exact", head: true }).eq("integration_status", "published").eq("is_active", true),
    supabaseAdmin.from("beta_pilot_enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("matches").select("id", { count: "exact", head: true }).eq("status", "disputed"),
    supabaseAdmin.from("studios").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
  ]);
  if ([games, activePlayers, disputes, studioReviews].some(({ error }) => error)) {
    return NextResponse.json({ error: "Could not calculate launch readiness" }, { status: 500 });
  }

  let chain = { escrowDeployed: false, operatorRole: false, arbiterRole: false };
  try {
    const signer = getOperatorAddress();
    const [code, operator, arbiter] = await Promise.all([
      escrowPublicClient.getCode({ address: ESCROW_CONTRACT_ADDRESS }),
      escrowPublicClient.readContract({ address: ESCROW_CONTRACT_ADDRESS, abi: accessControlAbi, functionName: "hasRole", args: [operatorRole, signer] }),
      escrowPublicClient.readContract({ address: ESCROW_CONTRACT_ADDRESS, abi: accessControlAbi, functionName: "hasRole", args: [arbiterRole, signer] }),
    ]);
    chain = { escrowDeployed: Boolean(code && code !== "0x"), operatorRole: operator, arbiterRole: arbiter };
  } catch {
    // A failed RPC or missing server signer is reported as not ready, never as a false positive.
  }

  const metrics = {
    publishedGames: games.count ?? 0,
    activePlayers: activePlayers.count ?? 0,
    capacity: 100,
    pendingDisputes: disputes.count ?? 0,
    pendingStudioReviews: studioReviews.count ?? 0,
  };
  const checks = {
    fiveGamesPublished: metrics.publishedGames >= 5,
    cohortWithinCapacity: metrics.activePlayers <= metrics.capacity,
    escrowDeployed: chain.escrowDeployed,
    operatorReady: chain.operatorRole,
    arbiterReady: chain.arbiterRole,
  };

  return NextResponse.json({
    ready: Object.values(checks).every(Boolean),
    checkedAt: new Date().toISOString(),
    checks,
    metrics,
  });
}
