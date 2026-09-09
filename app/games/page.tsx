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

const gameCovers: Record<string, { code: string; style: string }> = {
  "typing-sprint": {
    code: "TYP",
    style: "from-[#064e73] via-[#087fb2] to-[#12bff3]",
  },
  "arithmetic-rush": {
    code: "NUM",
    style: "from-[#172554] via-[#1d4ed8] to-[#38bdf8]",
  },
  "sequence-recall": {
    code: "SEQ",
    style: "from-[#312e81] via-[#4f46e5] to-[#22d3ee]",
  },
  "pattern-lock": {
    code: "PTR",
    style: "from-[#164e63] via-[#0e7490] to-[#67e8f9]",
  },
  "logic-grid": {
    code: "LOG",
    style: "from-[#0c4a6e] via-[#0369a1] to-[#818cf8]",
  },
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
              Your game library.
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
          <section className="py-8" aria-label="Available games">
            <div className="mb-5 flex items-center justify-between border-b border-arena-border pb-3">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-white">
                Installed for Season 00
              </p>
              <p className="font-mono text-xs text-arena-muted">SORT / SKILL</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {games.map((game, index) => (
              <article
                key={game.id}
                className="group relative overflow-hidden border border-arena-border bg-arena-surface shadow-[0_16px_36px_rgba(0,8,16,.24)] transition duration-200 hover:-translate-y-1 hover:border-arena-accent hover:shadow-[0_18px_42px_rgba(0,126,190,.22)]"
              >
                <div className={`game-cover relative aspect-[4/5] overflow-hidden bg-gradient-to-br ${gameCovers[game.slug ?? ""]?.style ?? "from-[#07304b] via-[#075985] to-[#38bdf8]"}`}>
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_35%,rgba(255,255,255,.16)_35%,rgba(255,255,255,.16)_36%,transparent_36%,transparent_62%,rgba(255,255,255,.1)_62%,rgba(255,255,255,.1)_63%,transparent_63%)]" />
                  <p className="absolute left-4 top-4 font-mono text-xs font-bold tracking-[.2em] text-white/70">
                    S00_{String(index + 1).padStart(2, "0")}
                  </p>
                  <strong className="absolute inset-x-4 bottom-5 font-display text-5xl font-black tracking-[-.05em] text-white drop-shadow-lg">
                    {gameCovers[game.slug ?? ""]?.code ?? "SKL"}
                  </strong>
                  <span className="absolute right-3 top-3 h-2 w-2 bg-[#b7ff4a] shadow-[0_0_12px_#b7ff4a]" aria-hidden="true" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-white">
                        {game.name}
                      </h2>
                      <p className="mt-1 text-xs text-arena-muted">
                        {gameNotes[game.slug ?? ""] ?? "Competitive decision-making"}
                      </p>
                    </div>
                    <Link
                      href="/challenges"
                      aria-label={`Play ${game.name}`}
                      className="grid h-9 w-9 shrink-0 place-items-center bg-arena-accent text-lg font-bold text-arena-bg transition group-hover:bg-white"
                    >
                      ↗
                    </Link>
                  </div>
                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-arena-muted">
                    {game.description ??
                      "A deterministic head-to-head skill round."}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] font-bold uppercase tracking-[.12em]">
                    <span className="text-[#b7ff4a]">Ready</span>
                    <span className="text-arena-muted">2 players</span>
                  </div>
                </div>
              </article>
            ))}
            </div>
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
