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

const gameCovers: Record<string, { code: string; style: string; motif: string }> = {
  "typing-sprint": { code: "TYP", style: "from-[#182a68] via-[#385be0] to-[#9c8cff]", motif: "⌁" },
  "arithmetic-rush": { code: "NUM", style: "from-[#783a25] via-[#db6a36] to-[#f5c46c]", motif: "＋" },
  "sequence-recall": { code: "SEQ", style: "from-[#075b68] via-[#078e9a] to-[#83e3d3]", motif: "◉" },
  "pattern-lock": { code: "PTR", style: "from-[#462f7e] via-[#835be7] to-[#e6a8ff]", motif: "⌘" },
  "logic-grid": { code: "LOG", style: "from-[#183f49] via-[#317d78] to-[#c4dfaa]", motif: "◇" },
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
  const featured = games[0];
  const featuredCover = featured?.slug ? gameCovers[featured.slug] : undefined;

  return (
    <GameShell>
      <main className="mx-auto max-w-[1440px] px-3 py-4 sm:px-5 sm:py-6 xl:px-7">
        <header className="mb-7 flex flex-col items-start justify-between gap-5 border-b border-[#e4e4de] pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="launcher-kicker">Game library <span className="text-[#9a9ca6]">/ Season 00</span></p>
            <h1 className="launcher-title mt-4 font-display text-5xl font-black sm:text-6xl">Game Lab<span className="text-[#5146e5]">.</span></h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#6f7682]">Pick a skill. Enter the arena. Every pilot player receives the same deterministic round, built for fair, verifiable competition.</p>
          </div>
          <Link href="/challenges" className="launcher-button-primary inline-flex min-h-11 items-center justify-center gap-5 px-5 text-sm font-extrabold">Enter Match Room <span aria-hidden="true">↗</span></Link>
        </header>

        {featured && featured.slug ? (
          <section className="launcher-panel overflow-hidden" aria-label="Featured game">
            <div className="grid lg:grid-cols-[1.25fr_.75fr]">
              <div className={`game-cover relative flex min-h-[270px] flex-col justify-between overflow-hidden bg-gradient-to-br p-6 text-white sm:min-h-[330px] sm:p-9 ${featuredCover?.style ?? "from-[#27336f] via-[#4e54c8] to-[#8c90f0]"}`}>
                <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,.12)_48%,transparent_49%)]" aria-hidden="true" />
                <div className="relative flex items-center justify-between gap-4">
                  <span className="rounded-full border border-white/35 bg-black/10 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[.2em] text-white">Featured title</span>
                  <span className="font-mono text-[10px] font-bold tracking-[.16em] text-white/80">S00 / 01</span>
                </div>
                <div className="relative">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[.22em] text-white/75">SkillFi original · Season 00</p>
                  <p className="mt-1 font-display text-[88px] font-black leading-none tracking-[-.09em] text-white drop-shadow-lg sm:text-[116px]">{featuredCover?.code ?? "SKL"}</p>
                </div>
                <span className="pointer-events-none absolute -right-8 top-8 font-display text-[230px] font-black leading-none text-white/10" aria-hidden="true">{featuredCover?.motif ?? "◈"}</span>
              </div>
              <div className="flex flex-col items-start justify-center p-6 sm:p-9">
                <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#5146e5]">Selected for you</p>
                <h2 className="mt-3 font-display text-3xl font-black tracking-[-.045em] text-[#20232c] sm:text-4xl">{featured.name}</h2>
                <p className="mt-2 text-sm font-bold text-[#656b78]">{gameNotes[featured.slug] ?? "Competitive skill"}</p>
                <p className="mt-4 max-w-md text-sm leading-6 text-[#777d88]">{featured.description ?? "A deterministic head-to-head skill round."}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href={`/games/${featured.slug}`} className="launcher-button-primary inline-flex min-h-11 items-center gap-5 px-5 text-sm font-extrabold">View game <span aria-hidden="true">↗</span></Link>
                  <Link href="/challenges" className="inline-flex min-h-11 items-center gap-3 rounded-[10px] border border-[#e4e4de] bg-white px-5 text-sm font-bold text-[#373b47] transition hover:border-[#bdb8ff] hover:text-[#5146e5]">Find a match <span aria-hidden="true">→</span></Link>
                </div>
                <p className="mt-5 text-[10px] font-medium text-[#9297a0]">Controlled pilot · No real-value rewards</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="launcher-panel p-8"><h2 className="text-xl font-bold">No games available</h2><p className="mt-2 text-sm text-[#737985]">The catalogue will appear when a published pilot game is available.</p></section>
        )}

        {games.length > 0 && (
          <section className="mt-9" aria-label="Available games">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div><p className="launcher-kicker">Your collection</p><h2 className="mt-2 font-display text-2xl font-black tracking-tight text-[#252833]">Browse all games</h2></div>
              <p className="text-xs font-semibold text-[#8a909a]">{games.length.toString().padStart(2, "0")} TITLES <span className="px-1">·</span> PILOT LIBRARY</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {games.map((game, index) => {
                const cover = gameCovers[game.slug ?? ""] ?? { code: "SKL", style: "from-[#24366c] via-[#555fd2] to-[#a2a5f8]", motif: "◈" };
                return (
                  <article key={game.id} className="group overflow-hidden rounded-2xl border border-[#e7e7e1] bg-white transition duration-200 hover:-translate-y-1 hover:border-[#c8c4ff] hover:shadow-[0_15px_35px_rgba(52,47,130,.1)]">
                    <Link href={`/games/${game.slug}`} className="block focus-visible:outline-none">
                      <div className={`game-cover relative flex aspect-[1.8/1] flex-col justify-between overflow-hidden bg-gradient-to-br p-5 text-white ${cover.style}`}>
                        <div className="relative flex items-start justify-between">
                          <span className="rounded-full border border-white/30 bg-black/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.16em] text-white/90">Skill trial</span>
                          <span className="font-mono text-[9px] font-bold tracking-[.14em] text-white/80">S00_{String(index + 1).padStart(2, "0")}</span>
                        </div>
                        <span className="pointer-events-none absolute right-5 top-0 font-display text-[118px] font-black leading-none text-white/15" aria-hidden="true">{cover.motif}</span>
                        <div className="relative flex items-end justify-between">
                          <span className="font-display text-5xl font-black leading-none tracking-[-.08em] text-white drop-shadow-lg">{cover.code}</span>
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-lg font-bold text-[#3530a3] transition group-hover:translate-x-1" aria-hidden="true">↗</span>
                        </div>
                      </div>
                      <div className="p-5">
                        <h3 className="font-display text-xl font-black tracking-[-.03em] text-[#252833]">{game.name}</h3>
                        <p className="mt-1 text-xs font-bold text-[#5146e5]">{gameNotes[game.slug ?? ""] ?? "Competitive decision-making"}</p>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#777d88]">{game.description ?? "A deterministic head-to-head skill round."}</p>
                        <div className="mt-5 flex items-center justify-between border-t border-[#efefea] pt-3">
                          <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#6f7e52]">Pilot ready</span>
                          <span className="text-xs font-extrabold text-[#5146e5]">View details →</span>
                        </div>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <footer className="mt-8 flex flex-col gap-3 border-t border-[#e5e5df] py-6 text-xs leading-5 text-[#898e98] sm:flex-row sm:items-center sm:justify-between">
          <p>Founders’ Pilot · Testnet only · No real-value reward promise</p>
          <Link href="/pilot" className="font-bold text-[#5146e5] hover:text-[#3930b3]">Read the pilot rules →</Link>
        </footer>
      </main>
    </GameShell>
  );
}
