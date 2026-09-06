import Link from "next/link";
import { GameShell } from "@/components/GameShell";
import { supabase } from "@/lib/supabaseClient";
import type { Game } from "@/lib/types";

export const dynamic = "force-dynamic";

const gameNotes: Record<string, string> = {
  "typing-sprint": "Speed + accuracy",
  "arithmetic-rush": "Mental arithmetic",
  "sequence-recall": "Working memory",
  "pattern-lock": "Pattern recognition",
  "logic-grid": "Deductive reasoning",
};

export default async function GamesPage() {
  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("is_active", true)
    .eq("integration_status", "published")
    .not("slug", "is", null)
    .order("name");
  const games = (data as Game[] | null) ?? [];

  return (
    <GameShell>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <header className="grid gap-6 border-b border-arena-border pb-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-arena-accent">
              Pilot catalogue / {games.length.toString().padStart(2, "0")}
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-.035em] text-white sm:text-6xl">
              Games built to be measured.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-arena-muted">
              Every pilot player receives the same deterministic round. Choose
              the skill you want to test, then enter the challenge queue.
            </p>
          </div>
          <Link
            href="/challenges"
            className="inline-flex min-h-11 items-center justify-center border border-slate-500 px-5 text-sm font-medium text-white transition-colors hover:border-white"
          >
            Open challenges{" "}
            <span className="ml-6" aria-hidden="true">
              →
            </span>
          </Link>
        </header>

        {games.length ? (
          <section
            className="border-b border-arena-border"
            aria-label="Available games"
          >
            {games.map((game, index) => (
              <article
                key={game.id}
                className="group grid gap-5 border-t border-arena-border py-7 first:border-t-0 md:grid-cols-[64px_1fr_180px_auto] md:items-center"
              >
                <p className="font-mono text-xs text-slate-600">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-2xl font-semibold text-white">
                      {game.name}
                    </h2>
                    <span className="border border-emerald-400/20 bg-emerald-400/[.06] px-2 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-emerald-300">
                      Pilot ready
                    </span>
                  </div>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-arena-muted">
                    {game.description ??
                      "A deterministic head-to-head skill round."}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[.16em] text-slate-600">
                    Primary skill
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {gameNotes[game.slug ?? ""] ??
                      "Competitive decision-making"}
                  </p>
                </div>
                <Link
                  href="/challenges"
                  aria-label={`Play ${game.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center border border-arena-border text-lg text-arena-muted transition-colors group-hover:border-arena-accent group-hover:text-arena-accent"
                >
                  ↗
                </Link>
              </article>
            ))}
          </section>
        ) : (
          <section className="border-b border-arena-border py-20 text-center">
            <p className="font-display text-2xl text-white">
              No pilot games are available.
            </p>
            <p className="mt-3 text-sm text-arena-muted">
              The catalogue will return after verification is complete.
            </p>
          </section>
        )}

        <footer className="flex flex-col gap-3 py-8 text-xs leading-5 text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>Controlled testnet pilot · no real-value reward promise</p>
          <Link href="/pilot" className="text-slate-400 hover:text-white">
            Read the pilot rules →
          </Link>
        </footer>
      </main>
    </GameShell>
  );
}
