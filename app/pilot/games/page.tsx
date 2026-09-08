import type { Metadata } from "next";
import Link from "next/link";
import { GameShell } from "@/components/GameShell";
import { PilotGameLab } from "@/components/PilotGameLab";

export const metadata: Metadata = {
  title: "Five-game pilot lab",
  description:
    "Test five original, deterministic SkillFi Arena skill games without real-value stakes.",
};

export default function PilotGamesPage() {
  return (
    <GameShell>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-7 sm:py-14">
        <div className="grid gap-7 border-b border-arena-border pb-9 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-arena-accent">
              Pilot lab / Five formats
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold tracking-[-.035em] text-white sm:text-6xl">
              Test the games before the match.
            </h1>
          </div>
          <p className="text-sm leading-7 text-arena-muted">
            Deterministic prompts, measurable answers and no blockchain
            transaction. Complete one saved run per game to cover the full pilot
            set.
          </p>
        </div>
        <div className="mt-10">
          <PilotGameLab />
        </div>
        <aside className="mt-8 grid border-y border-amber-400/25 text-sm text-amber-100 sm:grid-cols-[12rem_1fr]">
          <p className="border-b border-amber-400/25 px-4 py-4 text-[10px] font-bold uppercase tracking-[.16em] sm:border-b-0 sm:border-r">
            Pre-release boundary
          </p>
          <p className="px-4 py-4 leading-6">
            Original mechanics and test-only operation reduce
            intellectual-property and wagering risk, but do not constitute a
            legal opinion. Real-value or public launch remains blocked pending
            jurisdiction-specific counsel, final terms, privacy controls, and
            age/region enforcement.
          </p>
        </aside>
        <Link
          href="/pilot"
          className="mt-7 inline-flex border-b border-arena-accent pb-1 text-sm font-semibold text-arena-accent"
        >
          ← Pilot overview
        </Link>
      </main>
    </GameShell>
  );
}
