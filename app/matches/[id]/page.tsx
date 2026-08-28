import Link from "next/link";
import { notFound } from "next/navigation";
import { formatUsdcUnits } from "@/lib/env/public";
import { supabase } from "@/lib/supabaseClient";
import type { MatchWithRelations } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  searching: "Waiting for opponent",
  waiting_on_chain: "Waiting for deposits",
  active: "In progress",
  settling: "Settling",
  disputed: "Under review",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, challenge_id, smart_contract_match_id, game_id, player_a_id, player_b_id, stake_amount, status, winner_id, created_at, updated_at, game:games(id,name,type,is_active,created_at), player_a:users!matches_player_a_id_fkey(id,username,display_name,avatar_url,region,wallet_address), player_b:users!matches_player_b_id_fkey(id,username,display_name,avatar_url,region,wallet_address), challenge:challenges(id,rules,currency,status,accepted_at,expires_at)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error || !data) notFound();
  const match = data as unknown as MatchWithRelations;
  const playerA = match.player_a?.display_name ?? match.player_a?.username ?? "Player A";
  const playerB = match.player_b?.display_name ?? match.player_b?.username ?? "Waiting for Player B";

  return (
    <main className="min-h-screen bg-arena-bg px-6 py-8 text-arena-text">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-medium text-arena-muted hover:text-arena-text">
          Back to lobby
        </Link>

        <section className="mt-6 rounded-xl border border-arena-border bg-arena-surface p-6">
          <div className="flex flex-col gap-4 border-b border-arena-border pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-arena-muted">Canonical match</p>
              <h1 className="mt-1 font-display text-3xl font-bold">{match.game?.name ?? "SkillFi Arena"}</h1>
              <p className="mt-2 text-sm text-arena-muted">Match ID: {match.id}</p>
            </div>
            <div className="rounded-md border border-arena-accent-dim bg-arena-accent/10 px-4 py-2 text-sm font-semibold text-arena-accent">
              {STATUS_LABELS[match.status] ?? match.status}
            </div>
          </div>

          <div className="grid gap-4 py-6 sm:grid-cols-2">
            <PlayerCard label="Player A" name={playerA} region={match.player_a?.region} />
            <PlayerCard label="Player B" name={playerB} region={match.player_b?.region} />
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Entry per player" value={`${formatUsdcUnits(match.stake_amount)} USDC`} />
            <Detail label="Created" value={new Date(match.created_at).toLocaleString()} />
            {match.smart_contract_match_id && (
              <Detail label="On-chain match ID" value={match.smart_contract_match_id} wide />
            )}
            {match.challenge?.rules && <Detail label="Rules" value={match.challenge.rules} wide />}
          </dl>

          <MatchStatusNotice status={match.status} winner={
            match.winner_id === match.player_a_id ? playerA : match.winner_id === match.player_b_id ? playerB : null
          } />
        </section>
      </div>
    </main>
  );
}

function MatchStatusNotice({ status, winner }: { status: string; winner: string | null }) {
  const content =
    status === "disputed"
      ? "Automatic settlement is paused. An authorized arbiter is reviewing the on-chain dispute; neither player needs to submit another transaction."
      : status === "settling"
        ? "Both results are locked and the on-chain payout is being reconciled."
        : status === "completed"
          ? winner
            ? `Settlement completed. Winner: ${winner}.`
            : "Settlement completed."
          : status === "cancelled"
            ? "This match was cancelled. Any deposited stake has been returned through the escrow contract."
            : status === "active"
              ? "The match is live. Open the live match screen to play or report a result problem."
              : status === "waiting_on_chain"
                ? "The match is waiting for both players to approve and deposit their stake."
                : "This match is waiting for an opponent.";

  return (
    <p className={`mt-6 rounded-md border p-4 text-sm ${
      status === "disputed"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-arena-border bg-arena-bg text-arena-muted"
    }`}>
      {content}
    </p>
  );
}

function PlayerCard({ label, name, region }: { label: string; name: string; region?: string }) {
  return (
    <div className="rounded-lg border border-arena-border bg-arena-bg p-5">
      <p className="text-xs uppercase tracking-wide text-arena-muted">{label}</p>
      <p className="mt-2 font-display text-xl font-bold">{name}</p>
      {region && <p className="mt-1 text-sm text-arena-muted">{region}</p>}
    </div>
  );
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-md bg-arena-bg p-3 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-arena-muted">{label}</dt>
      <dd className="mt-1 break-all font-medium text-arena-text">{value}</dd>
    </div>
  );
}
