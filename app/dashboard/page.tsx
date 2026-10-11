import Link from "next/link";
import { GameShell } from "@/components/GameShell";

const games = [
  { title: "Typing Sprint", category: "SPEED / PRECISION", code: "TYP", glyph: "⌨", slug: "typing-sprint", colors: "from-[#172c8f] via-[#5652f2] to-[#e17ab8]", featured: true },
  { title: "Arithmetic Rush", category: "MENTAL MATH", code: "NUM", glyph: "∑", slug: "arithmetic-rush", colors: "from-[#e56545] via-[#f8a24b] to-[#f7d475]" },
  { title: "Sequence Recall", category: "MEMORY", code: "SEQ", glyph: "◈", slug: "sequence-recall", colors: "from-[#0c776f] via-[#19b8a7] to-[#9ce0ba]" },
  { title: "Pattern Lock", category: "PATTERN RECOGNITION", code: "PTR", glyph: "✳", slug: "pattern-lock", colors: "from-[#642c9f] via-[#a255d2] to-[#e8a5dc]" },
  { title: "Logic Grid", category: "LOGIC / STRATEGY", code: "LOG", glyph: "▦", slug: "logic-grid", colors: "from-[#163b69] via-[#3188ba] to-[#9ed8e9]" },
] as const;

export default function DashboardPage() {
  return (
    <GameShell>
      <main className="mx-auto max-w-[1680px] px-4 pb-16 pt-6 sm:px-7 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-[#6057dc]">SKILLFI / PLAYER LAUNCHER</p><h1 className="mt-1 font-display text-3xl font-black tracking-tight text-[#202333] sm:text-4xl">Discover & play</h1></div>
          <span className="rounded-full border border-[#dedcf8] bg-[#f1efff] px-4 py-2 text-[10px] font-black uppercase tracking-[.16em] text-[#5146c7]">Season 00 · Founders’ Pilot</span>
        </div>

        <section aria-label="Featured game" className="relative isolate min-h-[440px] overflow-hidden rounded-[28px] bg-[#11183b] text-white shadow-[0_22px_70px_rgba(29,36,92,.2)] sm:min-h-[510px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_45%,#6962ff_0%,#342c92_36%,#11183b_75%)]" />
          <div className="absolute -right-24 -top-32 h-[580px] w-[580px] rounded-full border-[70px] border-white/[.08] sm:right-[4%]" />
          <div className="absolute right-[8%] top-[12%] hidden h-[390px] w-[390px] rotate-[-19deg] rounded-[68px] border border-white/20 bg-gradient-to-br from-[#9b8cff]/50 via-[#5a53d9]/50 to-[#181f60] shadow-[30px_40px_80px_rgba(0,0,0,.3)] lg:grid lg:place-items-center">
            <span className="select-none font-display text-[200px] font-black italic leading-none text-white drop-shadow-[12px_20px_0_rgba(28,20,90,.5)]">S</span>
          </div>
          <div className="absolute bottom-[-190px] right-[5%] h-[380px] w-[650px] rotate-[-15deg] rounded-[70px] border-[2px] border-white/15" />
          <div className="relative z-10 flex min-h-[440px] max-w-[700px] flex-col items-start justify-center px-7 py-12 sm:min-h-[510px] sm:px-12 lg:px-16">
            <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.2em] text-white"><span className="h-2 w-2 rounded-full bg-[#a9fa8a]" /> FEATURED / SEASON 00</span>
            <p className="mb-3 text-sm font-bold uppercase tracking-[.25em] text-[#c3bdff]">THE ARENA IS OPEN</p>
            <h2 className="font-display text-6xl font-black leading-[.94] tracking-[-.055em] sm:text-7xl xl:text-[88px]">QUEUE UP.<br /><span className="text-[#b9afff]">PROVE IT.</span></h2>
            <p className="mt-6 max-w-[470px] text-sm leading-7 text-[#d9dbf5] sm:text-base">Five games. One player station. Sharpen your skills, enter the Match Room and put your performance to the test.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/games" className="inline-flex min-h-12 items-center gap-5 rounded-xl bg-white px-7 text-sm font-black text-[#27227d] transition hover:bg-[#e8e5ff]">Explore games <span aria-hidden="true">↗</span></Link>
              <Link href="/challenges" className="inline-flex min-h-12 items-center gap-5 rounded-xl border border-white/40 bg-white/10 px-6 text-sm font-bold text-white transition hover:bg-white/20">Match Room <span aria-hidden="true">→</span></Link>
            </div>
          </div>
          <div className="absolute bottom-5 right-6 z-10 text-[10px] font-black tracking-[.2em] text-white/60">SKILLFI / 001</div>
        </section>

        <section className="mt-11" aria-labelledby="library-heading">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#6159d8]">YOUR NEXT CHALLENGE</p><h2 id="library-heading" className="mt-2 font-display text-3xl font-black tracking-tight text-[#22263a]">Game library</h2></div>
            <Link href="/games" className="text-xs font-black text-[#5146e5] hover:underline">View all games ↗</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {games.map((game, index) => (
              <Link href={`/games/${game.slug}`} key={game.slug} className="group overflow-hidden rounded-2xl border border-[#e5e4ee] bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#afa8ff] hover:shadow-xl">
                <div className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-gradient-to-br ${game.colors}`}>
                  <div className="absolute inset-5 rounded-[32px] border-2 border-white/20 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105" />
                  <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full border-[26px] border-white/15" />
                  <div className="absolute -bottom-12 -left-12 h-48 w-48 rotate-45 rounded-[40px] border-[24px] border-white/10" />
                  <span className="relative font-display text-[100px] font-black leading-none text-white/90 drop-shadow-[8px_12px_0_rgba(0,0,0,.12)] sm:text-[130px]" aria-hidden="true">{game.glyph}</span>
                  <span className="absolute left-4 top-4 rounded-md bg-black/20 px-2 py-1 text-[10px] font-black tracking-widest text-white">{game.code} / 0{index + 1}</span>
                  <span className="absolute bottom-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-white text-xl font-black text-[#292b66] shadow-lg transition group-hover:scale-110" aria-hidden="true">↗</span>
                </div>
                <div className="px-4 py-4"><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#888b9b]">{game.category}</p><h3 className="mt-1 font-display text-base font-black text-[#25283a]">{game.title}</h3><p className="mt-3 text-xs font-bold text-[#5951d4]">Open game →</p></div>
              </Link>
            ))}
          </div>
        </section>
        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <Link href="/challenges" className="group flex min-h-36 flex-col justify-between rounded-2xl bg-[#eceaff] p-6 transition hover:bg-[#e1deff]"><span className="text-[10px] font-black uppercase tracking-[.2em] text-[#645bd1]">COMPETE</span><div className="flex items-end justify-between"><span className="font-display text-2xl font-black text-[#29265c]">Enter the Match Room</span><span className="text-2xl text-[#5146e5]">↗</span></div></Link>
          <Link href="/guilds" className="group flex min-h-36 flex-col justify-between rounded-2xl bg-[#e7f3f5] p-6 transition hover:bg-[#d9edf1]"><span className="text-[10px] font-black uppercase tracking-[.2em] text-[#397e91]">CONNECT</span><div className="flex items-end justify-between"><span className="font-display text-2xl font-black text-[#224955]">Explore Guild Hall</span><span className="text-2xl text-[#397e91]">↗</span></div></Link>
        </section>
        <p className="mt-8 text-center text-[10px] font-bold uppercase tracking-[.15em] text-[#8b90a0]">Controlled pilot · Testnet only · No real-value rewards</p>
      </main>
    </GameShell>
  );
}
