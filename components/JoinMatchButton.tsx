"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { erc20Abi, formatUnits } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { ESCROW_CONTRACT_ADDRESS, GNESS_TOKEN_ADDRESS, SETTLEMENT_ASSET_LABEL } from "@/lib/contracts";
import { skillFiEscrowAbi } from "@/lib/abi/skillFiEscrow";

export function JoinMatchButton({ matchId, stakeAmount }: { matchId: string; stakeAmount: string }) {
  const router = useRouter();
  const { getAccessToken } = usePrivy();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: decimals } = useReadContract({ address: GNESS_TOKEN_ADDRESS, abi: erc20Abi, functionName: "decimals" });
  const { data: allowance, refetch } = useReadContract({
    address: GNESS_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, ESCROW_CONTRACT_ADDRESS] : undefined,
    query: { enabled: Boolean(address) },
  });

  async function join() {
    if (!address || !publicClient) return setError("Connect your wallet first.");
    if (decimals === undefined) return setError("Loading token information…");
    setBusy(true); setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Log in with Privy first.");
      const checkResponse = await fetch("/api/matches/join/check", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId }),
      });
      const checkBody = await checkResponse.json().catch(() => ({}));
      if (!checkResponse.ok) throw new Error(checkBody.error ?? "Risk check failed.");
      const stake = BigInt(stakeAmount);
      const currentAllowance = (await refetch()).data ?? allowance ?? 0n;
      if (currentAllowance < stake) {
        const approveHash = await writeContractAsync({ address: GNESS_TOKEN_ADDRESS, abi: erc20Abi, functionName: "approve", args: [ESCROW_CONTRACT_ADDRESS, stake] });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }
      const joinHash = await writeContractAsync({ address: ESCROW_CONTRACT_ADDRESS, abi: skillFiEscrowAbi, functionName: "joinMatch", args: [BigInt(matchId)] });
      await publicClient.waitForTransactionReceipt({ hash: joinHash });
      const response = await fetch("/api/matches/join", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ matchId, txHash: joinHash }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not register your join.");
      router.push(`/match/${matchId}`);
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Join failed"); }
    finally { setBusy(false); }
  }

  return <div className="flex flex-col items-end gap-1">
    <button type="button" onClick={join} disabled={busy} className="rounded-md bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg hover:bg-arena-accent/90 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Joining…" : `Join · ${decimals === undefined ? "…" : formatUnits(BigInt(stakeAmount), decimals)} ${SETTLEMENT_ASSET_LABEL}`}</button>
    {error && <span className="max-w-48 text-right text-xs text-arena-danger">{error}</span>}
  </div>;
}
