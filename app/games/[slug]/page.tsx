import Link from "next/link";
import { notFound } from "next/navigation";
import { GameShell } from "@/components/GameShell";
import { supabase } from "@/lib/supabaseClient";
import type { Game } from "@/lib/types";

export const dynamic = "force-dynamic";

const gameMeta: Record<string, { code: string; skill: string; style: string }> = {
  "typing-sprint": { code: "TYP", skill: "Speed + accuracy", style: "from-[#064e73] via-[#087fb2] to-[#12bff3]" },
  "arithmetic-rush": { code: "NUM", skill: "Mental arithmetic", style: "from-[#172554] via-[#1d4ed8] to-[#38bdf8]" },
  "sequence-recall": { code: "SEQ", skill: "Working memory", style: "from-[#312e81] via-[#4f46e5] to-[#22d3ee]" },
  "pattern-lock": { code: "PTR", skill: "Pattern recognition", style: "from-[#164e63] via-[#0e7490] to-[#67e8f9]" },
  "logic-grid": { code: "LOG", skill: "Deductive reasoning", style: "from-[#0c4a6e] via-[#0369a1] to-[#818cf8]" },
};

export default async function GameDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("integration_status", "published")
    .maybeSingle();

  const game = data as Game | null;
  if (!game) notFound();

  const meta = gameMeta[slug] ?? {
    code: "SKL",
    skill: "Competitive decision-making",
    style: "from-[#07304b] via-[#075985] to-[#38bdf8]",
  };

  return (
    <GameShell>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link href="/games" className="text-sm font-semibold text-arena-muted hover:text-arena-accent">
            ← Back to game library
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[.16em] text-arena-muted">
            Season 00 / Founders&apos; Pilot
          </span>
        </div>

        <section className="grid overflow-hidden border border-arena-border bg-arena-surface lg:grid-cols-[.8fr_1.2fr]">
          <div className={`relative min-h-[360px] overflow-hidden bg-gradient-to-br ${meta.style}`}>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_35%,rgba(255,255,255,.16)_35%,rgba(255,255,255,.16)_36%,transparent_36%,transparent_62%,rgba(255,255,255,.1)_62%,rgba(255,255,255,.1)_63%,transparent_63%)]" />
            <span className="absolute left-6 top-6 font-mono text-xs font-bold tracking-[.2em] text-white/75">
              S00 / PILOT
            </span>
            <strong className="absolute inset-x-6 bottom-8 font-display text-8xl font-black tracking-[-.07em] text-white drop-shadow-lg">
              {meta.code}
            </strong>
            <span className="absolute right-6 top-6 h-2.5 w-2.5 bg-[#b7ff4a] shadow-[0_0_14px_#b7ff4a]" />
          </div>

          <div className="p-7 sm:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-arena-border bg-[#f4f7f6] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[.14em] text-arena-accent">
                Skill trial
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[#4f7b22]">
                Pilot ready
              </span>
            </div>

            <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-.04em] text-arena-text sm:text-6xl">
              {game.name}
            </h1>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[.12em] text-arena-accent">
              {meta.skill}
            </p>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-arena-muted">
              {game.description ?? "A deterministic head-to-head skill round built for the Season 00 pilot."}
            </p>

            <div className="mt-8 grid gap-3 border-y border-arena-border py-5 sm:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-[.14em] text-arena-muted">Format</p>
                <p className="mt-1 text-sm font-semibold text-arena-text">Head-to-head</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[.14em] text-arena-muted">Rules</p>
                <p className="mt-1 text-sm font-semibold text-arena-text">Controlled pilot</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[.14em] text-arena-muted">Players</p>
                <p className="mt-1 text-sm font-semibold text-arena-text">2 per round</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/challenges" className="inline-flex min-h-11 items-center justify-center bg-arena-accent px-5 text-sm font-bold text-arena-bg hover:bg-cyan-300">
                Enter challenge queue →
              </Link>
              <Link href="/pilot" className="text-sm font-semibold text-arena-muted hover:text-arena-accent">
                Read pilot rules
              </Link>
            </div>

            <p className="mt-6 max-w-xl text-xs leading-5 text-arena-muted">
              Season 00 is a controlled testnet playtest. No entry fee, token sale or real-value prize pool.
            </p>
          </div>
        </section>
      </main>
    </GameShell>
  );
}
