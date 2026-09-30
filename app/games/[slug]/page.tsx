import Link from "next/link";
import { notFound } from "next/navigation";
import { GameShell } from "@/components/GameShell";
import { supabase } from "@/lib/supabaseClient";
import type { Game } from "@/lib/types";

export const dynamic = "force-dynamic";

const gameMeta: Record<string, { code: string; skill: string; style: string; index: string }> = {
  "typing-sprint": { code: "TYP", skill: "Speed + accuracy", style: "from-[#075985] via-[#0891b2] to-[#22d3ee]", index: "01" },
  "arithmetic-rush": { code: "NUM", skill: "Mental arithmetic", style: "from-[#1d4ed8] via-[#2563eb] to-[#38bdf8]", index: "02" },
  "sequence-recall": { code: "SEQ", skill: "Working memory", style: "from-[#4338ca] via-[#6366f1] to-[#22d3ee]", index: "03" },
  "pattern-lock": { code: "PTR", skill: "Pattern recognition", style: "from-[#0e7490] via-[#0891b2] to-[#67e8f9]", index: "04" },
  "logic-grid": { code: "LOG", skill: "Deductive reasoning", style: "from-[#0369a1] via-[#2563eb] to-[#818cf8]", index: "05" },
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
    style: "from-[#075985] via-[#0891b2] to-[#38bdf8]",
    index: "00",
  };

  return (
    <GameShell>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/games" className="text-xs font-semibold uppercase tracking-[.16em] text-arena-muted hover:text-arena-accent">
            ← Game library
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[.16em] text-arena-muted">
            Season 00 / {meta.index}
          </span>
        </div>

        <section className="grid overflow-hidden border border-arena-border bg-arena-surface lg:grid-cols-[.9fr_1.1fr]">
          <div className={`relative min-h-[360px] overflow-hidden bg-gradient-to-br ${meta.style} p-7 sm:min-h-[460px] sm:p-10`}>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_30%,rgba(255,255,255,.16)_30%,rgba(255,255,255,.16)_31%,transparent_31%,transparent_62%,rgba(255,255,255,.12)_62%,rgba(255,255,255,.12)_63%,transparent_63%)]" />
            <span className="relative border border-white/30 bg-black/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[.18em] text-white">
              Founders' Pilot
            </span>
            <div className="absolute inset-x-7 bottom-8 sm:inset-x-10 sm:bottom-10">
              <p className="font-mono text-xs font-bold tracking-[.22em] text-white/70">{meta.code}_S00</p>
              <h1 className="mt-3 font-display text-5xl font-black tracking-[-.05em] text-white sm:text-7xl">
                {game.name}
              </h1>
            </div>
          </div>

          <div className="flex flex-col p-7 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <span className="border border-arena-border bg-[#f4f7f6] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[.14em] text-arena-accent">
                Skill trial
              </span>
              <span className="border border-arena-border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[.14em] text-arena-muted">
                Pilot ready
              </span>
            </div>

            <p className="mt-8 text-xs font-semibold uppercase tracking-[.16em] text-arena-muted">Primary skill</p>
            <p className="mt-2 font-display text-3xl font-semibold text-arena-text">{meta.skill}</p>

            <p className="mt-7 max-w-xl text-sm leading-7 text-arena-muted">
              {game.description ?? "A deterministic head-to-head skill round built for the controlled Season 00 pilot."}
            </p>

            <div className="mt-8 grid border-y border-arena-border sm:grid-cols-2">
              <div className="border-b border-arena-border py-4 sm:border-b-0 sm:border-r sm:pr-5">
                <p className="font-mono text-[9px] uppercase tracking-[.16em] text-arena-muted">Format</p>
                <p className="mt-1 text-sm font-semibold text-arena-text">Head-to-head</p>
              </div>
              <div className="py-4 sm:pl-5">
                <p className="font-mono text-[9px] uppercase tracking-[.16em] text-arena-muted">Environment</p>
                <p className="mt-1 text-sm font-semibold text-arena-text">Controlled pilot</p>
              </div>
            </div>

            <div className="mt-auto pt-8">
              <Link
                href="/challenges"
                className="inline-flex min-h-12 w-full items-center justify-center bg-arena-accent px-6 text-sm font-bold text-[#071015] transition hover:bg-cyan-200"
              >
                Enter match room <span className="ml-auto">↗</span>
              </Link>
              <p className="mt-3 text-center text-[10px] uppercase tracking-[.14em] text-arena-muted">
                No real-value reward promise · testnet pilot
              </p>
            </div>
          </div>
        </section>
      </main>
    </GameShell>
  );
}
