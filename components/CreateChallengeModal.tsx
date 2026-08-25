"use client";

import { useEffect, useState, type FormEvent } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { erc20Abi, parseUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { skillFiEscrowAbi } from "@/lib/abi/skillFiEscrow";
import { ESCROW_CONTRACT_ADDRESS, GNESS_TOKEN_ADDRESS } from "@/lib/contracts";
import type { Game, PlayerProfile } from "@/lib/types";

type Phase = "form" | "creating" | "approving" | "joining" | "indexing" | "success" | "error";

const LABELS: Record<Phase, string> = {
  form: "",
  creating: "Creating the match on-chain...",
  approving: "Confirm the token approval...",
  joining: "Confirm the entry-fee deposit...",
  indexing: "Starting the live match...",
  success: "Challenge created!",
  error: "",
};

export function CreateChallengeModal({
  open,
  onClose,
  games,
  currentUser,
}: {
  open: boolean;
  onClose: () => void;
  games: Game[];
  currentUser: PlayerProfile | null;
}) {
  const { getAccessToken } = usePrivy();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [stakeInput, setStakeInput] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: decimals } = useReadContract({
    address: GNESS_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "decimals",
  });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: GNESS_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, ESCROW_CONTRACT_ADDRESS] : undefined,
    query: { enabled: Boolean(address) },
  });

  useEffect(() => {
    if (open) {
      setPhase("form");
      setErrorMessage(null);
      setStakeInput("");
      setGameId(games[0]?.id ?? "");
    }
  }, [open, games]);

  if (!open) return null;

  const isBusy = !["form", "error", "success"].includes(phase);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (!address || !publicClient) {
      setErrorMessage("Connect your wallet first.");
      return;
    }
    if (!currentUser) {
      setErrorMessage("Complete your SkillFi profile first.");
      return;
    }
    if (decimals === undefined) {
      setErrorMessage("Loading token information. Try again shortly.");
      return;
    }
    if (!gameId) {
      setErrorMessage("Choose a game.");
      return;
    }

    let stakeAmount: bigint;
    try {
      stakeAmount = parseUnits(stakeInput, decimals);
      if (stakeAmount <= 0n) throw new Error("invalid stake");
    } catch {
      setErrorMessage("Enter a valid stake amount.");
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Privy authentication is required.");

      setPhase("creating");
      const createResponse = await fetch("/api/matches/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gameId, stakeAmount: stakeAmount.toString() }),
      });
      const createBody = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) throw new Error(createBody.error ?? "Could not create the match.");

      const matchId = BigInt(createBody.match.smart_contract_match_id);
      const freshAllowance = (await refetchAllowance()).data ?? allowance ?? 0n;
      if (freshAllowance < stakeAmount) {
        setPhase("approving");
        const approveHash = await writeContractAsync({
          address: GNESS_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [ESCROW_CONTRACT_ADDRESS, stakeAmount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setPhase("joining");
      const joinHash = await writeContractAsync({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: skillFiEscrowAbi,
        functionName: "joinMatch",
        args: [matchId],
      });
      await publicClient.waitForTransactionReceipt({ hash: joinHash });

      setPhase("indexing");
      const joinResponse = await fetch("/api/matches/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId: matchId.toString(), txHash: joinHash }),
      });
      const joinBody = await joinResponse.json().catch(() => ({}));
      if (!joinResponse.ok) throw new Error(joinBody.error ?? "Could not register the join.");

      setPhase("success");
      setTimeout(onClose, 1000);
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-arena-border bg-arena-surface p-6 shadow-arena-glow">
        <h2 className="font-display text-xl font-bold text-arena-text">Create a Challenge</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <select
            aria-label="Game"
            value={gameId}
            onChange={(event) => setGameId(event.target.value)}
            disabled={isBusy}
            className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text"
          >
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
          <div className="rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-sm text-arena-muted">
            Region: {currentUser?.region ?? "-"}
          </div>
          <input
            aria-label="Stake amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={stakeInput}
            onChange={(event) => setStakeInput(event.target.value)}
            disabled={isBusy}
            placeholder="10.00"
            className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text"
          />
          {isBusy && (
            <div className="rounded-md border border-arena-accent-dim bg-arena-accent/10 px-3 py-2 text-sm text-arena-accent">
              {LABELS[phase]}
            </div>
          )}
          {phase === "success" && (
            <div className="rounded-md border border-arena-win/40 bg-arena-win/10 px-3 py-2 text-sm text-arena-win">
              Your stake is locked. Waiting for an opponent.
            </div>
          )}
          {errorMessage && (
            <div className="rounded-md border border-arena-danger/40 bg-arena-danger/10 px-3 py-2 text-sm text-arena-danger">
              {errorMessage}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isBusy} className="rounded-md px-4 py-2 text-sm text-arena-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isBusy || !stakeInput}
              className="rounded-md bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg disabled:opacity-50"
            >
              {isBusy ? "Processing..." : "Create & Deposit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
