import { NextRequest, NextResponse } from "next/server";
import { keccak256, parseAbi, stringToBytes } from "viem";
import { getCurrentProfile } from "@/lib/auth/server";
import { isStudioAdmin } from "@/lib/studioAdmin";
import { ESCROW_CONTRACT_ADDRESS, escrowPublicClient, getOperatorAddress } from "@/lib/serverEscrow";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const accessControlAbi = parseAbi(["function hasRole(bytes32,address) view returns(bool)"]);
const arbiterRole = keccak256(stringToBytes("ARBITER_ROLE"));
const operatorRole = keccak256(stringToBytes("OPERATOR_ROLE"));
const defaultAdminRole = `0x${"0".repeat(64)}` as const;

export async function GET(request: NextRequest) {
  const user = await getCurrentProfile(request.headers.get("authorization"));
  if (!user || !isStudioAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: disputes, error } = await supabaseAdmin.from("matches")
    .select("id,smart_contract_match_id,created_at")
    .eq("status", "disputed")
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) return NextResponse.json({ error: "Could not load dispute readiness" }, { status: 500 });

  let signer: `0x${string}`;
  try {
    signer = getOperatorAddress();
  } catch {
    return NextResponse.json({
      ready: false,
      operatorConfigured: false,
      roles: { arbiter: false, operator: false, admin: false },
      pendingResolutionCount: disputes?.length ?? 0,
      disputes: disputes ?? [],
      nextAction: "Configure the server-only operator signer",
    });
  }

  const [code, hasArbiterRole, hasOperatorRole, hasAdminRole] = await Promise.all([
    escrowPublicClient.getCode({ address: ESCROW_CONTRACT_ADDRESS }),
    escrowPublicClient.readContract({ address: ESCROW_CONTRACT_ADDRESS, abi: accessControlAbi, functionName: "hasRole", args: [arbiterRole, signer] }),
    escrowPublicClient.readContract({ address: ESCROW_CONTRACT_ADDRESS, abi: accessControlAbi, functionName: "hasRole", args: [operatorRole, signer] }),
    escrowPublicClient.readContract({ address: ESCROW_CONTRACT_ADDRESS, abi: accessControlAbi, functionName: "hasRole", args: [defaultAdminRole, signer] }),
  ]);
  const escrowDeployed = Boolean(code && code !== "0x");

  return NextResponse.json({
    ready: escrowDeployed && hasArbiterRole,
    operatorConfigured: true,
    escrowDeployed,
    signer: `${signer.slice(0, 6)}…${signer.slice(-4)}`,
    roles: { arbiter: hasArbiterRole, operator: hasOperatorRole, admin: hasAdminRole },
    pendingResolutionCount: disputes?.length ?? 0,
    disputes: disputes ?? [],
    nextAction: !hasArbiterRole
      ? "Grant ARBITER_ROLE to the configured signer from the contract admin wallet"
      : disputes?.length
        ? "Select a pending dispute and explicitly choose its winning participant"
        : "Wait for a participant to submit a dispute",
  });
}
