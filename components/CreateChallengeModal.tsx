"use client";

import { useEffect, useState, type FormEvent } from "react";
import { erc20Abi, keccak256, parseUnits, toBytes } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { ESCROW_CONTRACT_ADDRESS, GNESS_TOKEN_ADDRESS } from "@/lib/contracts";
import { skillFiEscrowAbi } from "@/lib/abi/skillFiEscrow";
import type { Game, PlayerProfile } from "@/lib/types";

type Phase =
  | "form"
  | "approving"
  | "awaiting-approval"
  | "depositing"
  | "awaiting-deposit"
  | "indexing"
  | "success"
  | "error";

const PHASE_LABELS: Record<Phase, string> = {
  form: "",
  approving: "Confirm the GNESS approval in your wallet…",
  "awaiting-approval": "Waiting for approval to confirm on-chain…",
  depositing: "Confirm the entry-fee deposit in your wallet…",
  "awaiting-deposit": "Waiting for your deposit to confirm on-chain…",
  indexing: "Verifying your deposit and creating the challenge…",
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

  // Reset to a clean form each time the modal is (re)opened, rather than
  // leaving a previous success/error state lingering on next open.
  useEffect(() => {
    if (open) {
      setPhase("form");
      setErrorMessage(null);
      setStakeInput("");
      setGameId(games[0]?.id ?? "");
    }
  }, [open, games]);

  if (!open) return null;

  const isBusy = phase !== "form" && phase !== "error" && phase !== "success";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (!address || !publicClient) {
      setErrorMessage("Connect your wallet first.");
      return;
    }
    if (decimals === undefined) {
      setErrorMessage("Still loading token info — try again in a moment.");
      return;
    }
    if (!gameId) {
      setErrorMessage("Choose a game.");
      return;
    }

    let stakeAmount: bigint;
    try {
      stakeAmount = parseUnits(stakeInput, decimals);
      if (stakeAmount <= BigInt(0)) throw new Error("Stake must be greater than zero.");
    } catch {
      setErrorMessage("Enter a valid stake amount.");
      return;
    }

    try {
      // --- Step 1: ERC20 approval, only if the existing allowance is short.
      //     SkillFiEscrow.createMatch calls safeTransferFrom under the hood,
      //     which reverts outright without a prior approve() for at least
      //     the entry fee amount. ---
      const freshAllowance = (await refetchAllowance()).data ?? allowance ?? BigInt(0);
      if (freshAllowance < stakeAmount) {
        setPhase("approving");
        const approveHash = await writeContractAsync({
          address: GNESS_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [ESCROW_CONTRACT_ADDRESS, stakeAmount],
        });
        setPhase("awaiting-approval");
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // --- Step 2: the actual deposit. matchId is generated client-side —
      //     SkillFiEscrow's createMatch takes it as a caller-supplied
      //     argument rather than generating one on-chain. ---
      const matchId = keccak256(toBytes(crypto.randomUUID()));

      setPhase("depositing");
      const createHash = await writeContractAsync({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: skillFiEscrowAbi,
        functionName: "createMatch",
        args: [matchId, stakeAmount],
      });
      setPhase("awaiting-deposit");
      await publicClient.waitForTransactionReceipt({ hash: createHash });

      // --- Step 3: hand off to the server, which independently re-verifies
      //     this transaction against the chain before writing to Supabase.
      //     See app/api/matches/create/route.ts for why this isn't a direct
      //     client-side insert. ---
      setPhase("indexing");
      const response = await fetch("/api/matches/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: createHash, matchId, gameId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to register the challenge after deposit.");
      }

      setPhase("success");
      // The lobby's realtime subscription (LobbyClient) will pick up the
      // new row on its own — closing here just dismisses the modal.
      setTimeout(onClose, 1200);
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-challenge-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !isBusy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-arena-border bg-arena-surface p-6 shadow-arena-glow">
        <h2 id="create-challenge-title" className="font-display text-xl font-bold text-arena-text">
          Create a Challenge
        </h2>

        {!currentUser ? (
          <p className="mt-4 rounded-md border border-arena-border bg-arena-bg p-4 text-sm text-arena-muted">
            This wallet isn&apos;t linked to a SkillFi account yet. Link your account before creating a
            challenge — the server needs a verified wallet-to-account mapping to credit the right player.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="game" className="mb-1 block text-sm font-medium text-arena-muted">
                Game
              </label>
              <select
                id="game"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                disabled={isBusy}
                className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text focus:border-arena-accent focus:outline-none disabled:opacity-50"
              >
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="mb-1 block text-sm font-medium text-arena-muted">Region</span>
              {/* Region isn't a free-choice field here: it's inherited from the
                  creator's own profile (users.region), exactly as the
                  matchmaking find_match() function already assumes in the
                  schema — there's no matches.region column for a per-challenge
                  value to live in. Shown for transparency, not as a selector. */}
              <div className="rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text">
                {currentUser.region} <span className="text-arena-muted">(from your profile)</span>
              </div>
            </div>

            <div>
              <label htmlFor="stake" className="mb-1 block text-sm font-medium text-arena-muted">
                Stake amount (GNESS)
              </label>
              <input
                id="stake"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                disabled={isBusy}
                placeholder="10.00"
                className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text focus:border-arena-accent focus:outline-none disabled:opacity-50"
              />
            </div>

            {isBusy && (
              <div className="flex items-center gap-2 rounded-md border border-arena-accent-dim bg-arena-accent/10 px-3 py-2 text-sm text-arena-accent">
                <span className="h-2 w-2 animate-pulse rounded-full bg-arena-accent" />
                {PHASE_LABELS[phase]}
              </div>
            )}

            {phase === "success" && (
              <div className="rounded-md border border-arena-win/40 bg-arena-win/10 px-3 py-2 text-sm text-arena-win">
                Challenge created — it&apos;ll appear in the lobby now.
              </div>
            )}

            {errorMessage && (
              <div className="rounded-md border border-arena-danger/40 bg-arena-danger/10 px-3 py-2 text-sm text-arena-danger">
                {errorMessage}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="rounded-md px-4 py-2 text-sm text-arena-muted hover:text-arena-text disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBusy || !stakeInput}
                className="rounded-md bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg hover:bg-arena-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy ? "Processing…" : "Deposit & Create"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
