import Link from "next/link";
import { GameShell } from "@/components/GameShell";

const steps = [
  [
    "01",
    "Choose a game",
    "Five original skill games are available in the controlled pilot.",
  ],
  [
    "02",
    "Open a challenge",
    "Set the testnet entry and wait for another approved pilot player.",
  ],
  [
    "03",
    "Play and verify",
    "Both players receive the same deterministic round; results are recorded for review.",
  ],
] as const;

export default function DashboardPage() {
  return (
    <GameShell>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="grid gap-10 border-b border-arena-border pb-12 lg:grid-cols-[1.35fr_.65fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-arena-accent">
              Controlled pilot / Arc Testnet
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.035em] text-white sm:text-7xl">
              Compete on skill.
              <br />
              <span className="text-slate-500">Verify the result.</span>
            </h1>
          </div>
          <div className="lg:pb-1">
            <p className="max-w-md text-sm leading-7 text-arena-muted">
              A focused testing environment for deterministic
              player-versus-player games. No simulated earnings, no fictional
              activity feed, and no promised monetary value.
            </p>
            <Link
              href="/challenges"
              className="mt-7 inline-flex min-h-11 items-center bg-arena-accent px-5 text-sm font-semibold text-[#071015] transition-colors hover:bg-cyan-200"
            >
              Find a challenge{" "}
              <span className="ml-8" aria-hidden="true">
                ↗
              </span>
            </Link>
          </div>
        </section>
        <section
          className="grid border-b border-arena-border md:grid-cols-3"
          aria-labelledby="flow-heading"
        >
          <h2 id="flow-heading" className="sr-only">
            How the pilot works
          </h2>
          {steps.map(([index, title, copy]) => (
            <article
              key={index}
              className="border-arena-border py-8 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
            >
              <p className="font-mono text-[10px] text-arena-accent">{index}</p>
              <h3 className="mt-5 font-display text-2xl font-semibold text-white">
                {title}
              </h3>
              <p className="mt-3 max-w-sm text-sm leading-6 text-arena-muted">
                {copy}
              </p>
            </article>
          ))}
        </section>
        <section className="grid gap-8 py-12 lg:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Pilot status
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-white">
              Built for a small, observable cohort.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-arena-muted">
              The current release limits participation to 100 approved players.
              Match creation, result submission, and feedback remain inspectable
              during the pilot.
            </p>
          </div>
          <div className="grid grid-cols-2 border border-arena-border">
            <div className="border-b border-r border-arena-border p-5">
              <p className="text-[10px] uppercase tracking-[.16em] text-slate-600">
                Games
              </p>
              <p className="mt-3 font-display text-3xl text-white">05</p>
            </div>
            <div className="border-b border-arena-border p-5">
              <p className="text-[10px] uppercase tracking-[.16em] text-slate-600">
                Cohort cap
              </p>
              <p className="mt-3 font-display text-3xl text-white">100</p>
            </div>
            <Link
              href="/games"
              className="border-r border-arena-border p-5 text-sm font-medium text-slate-300 hover:bg-white/[.025] hover:text-white"
            >
              Browse games{" "}
              <span className="float-right" aria-hidden="true">
                →
              </span>
            </Link>
            <Link
              href="/pilot"
              className="p-5 text-sm font-medium text-slate-300 hover:bg-white/[.025] hover:text-white"
            >
              Pilot details{" "}
              <span className="float-right" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </section>
      </main>
    </GameShell>
  );
}
