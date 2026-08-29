import Link from "next/link";
import { GameShell } from "@/components/GameShell";

const activity = [
  { game: "Neon Tactics", result: "Victory", rival: "ghost.unit", prize: "+8.40 USDC", color: "text-emerald-300" },
  { game: "Aim Protocol", result: "Defeat", rival: "KIRA-9", prize: "-5.00 USDC", color: "text-rose-300" },
  { game: "Cipher Duel", result: "Victory", rival: "0xRook", prize: "+12.00 USDC", color: "text-emerald-300" },
];

export default function DashboardPage() {
  return (
    <GameShell>
      <main className="mx-auto max-w-[1480px] px-4 py-7 sm:px-7 lg:py-9">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Player command center</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">Ready for the next fight?</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Your games, challenges, guild orders and onchain rewards—one tactical view.</p></div>
          <Link href="/challenges" className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-[#071015] shadow-[0_0_30px_-10px_#22d3ee] transition hover:bg-cyan-200">FIND A CHALLENGE →</Link>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[['1,284','RATING','Diamond II'],['68%','WIN RATE','34 wins'],['126.40','USDC EARNED','Season total'],['#18','GUILD RANK','Arc Vanguard']].map(([value,label,note]) => <article key={label} className="rounded-2xl border border-white/7 bg-white/[0.035] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">{label}</p><p className="mt-3 font-display text-3xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></article>)}
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <section className="relative min-h-[360px] overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(115deg,#101b2b_0%,#11172a_48%,#251536_100%)] p-7 sm:p-9">
            <div className="absolute -right-16 -top-20 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" /><div className="absolute bottom-0 right-0 h-56 w-2/3 bg-[linear-gradient(135deg,transparent,rgba(34,211,238,.08))]" />
            <div className="relative flex h-full max-w-xl flex-col"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> Continue playing</div><h2 className="mt-8 font-display text-5xl font-black uppercase italic leading-none text-white sm:text-6xl">Neon<br/><span className="text-cyan-300">Tactics</span></h2><p className="mt-4 text-sm leading-6 text-slate-400">Ranked 2v2 · Your squad is online · Arc settlement enabled</p><div className="mt-auto flex flex-wrap gap-3 pt-8"><Link href="/games" className="rounded-xl bg-white px-5 py-3 text-sm font-black text-black">LAUNCH GAME</Link><Link href="/challenges" className="rounded-xl border border-white/15 bg-black/20 px-5 py-3 text-sm font-bold text-white">VIEW LOBBY</Link></div></div>
          </section>

          <section className="rounded-3xl border border-indigo-400/15 bg-indigo-500/[0.055] p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300">Guild war</p><h2 className="mt-2 font-display text-2xl font-bold">Arc Vanguard</h2></div><span className="grid h-12 w-12 place-items-center rounded-2xl border border-indigo-300/20 bg-indigo-300/10 text-2xl">⬢</span></div><div className="mt-7 rounded-2xl border border-white/7 bg-black/20 p-4"><div className="flex items-center justify-between text-xs"><span className="text-slate-500">This week</span><span className="font-bold text-indigo-200">VANGUARD vs VOIDRUNNERS</span></div><div className="mt-4 flex items-end gap-3"><span className="font-display text-5xl font-black text-white">42</span><span className="pb-2 text-slate-600">—</span><span className="font-display text-4xl font-bold text-slate-500">37</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full w-[68%] bg-gradient-to-r from-indigo-400 to-cyan-300" /></div></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-[10px] text-slate-600">TREASURY</p><p className="mt-1 font-bold">1,840 USDC</p></div><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-[10px] text-slate-600">YOUR CONTRIBUTION</p><p className="mt-1 font-bold text-cyan-300">8 wins</p></div></div><Link href="/guilds" className="mt-5 block rounded-xl border border-indigo-300/20 py-3 text-center text-xs font-bold text-indigo-200 hover:bg-indigo-300/10">ENTER GUILD WAR ROOM</Link></section>
        </div>

        <section className="mt-5 rounded-3xl border border-white/7 bg-white/[0.025] p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Combat log</p><h2 className="mt-1 font-display text-2xl font-bold">Recent matches</h2></div><Link href="/profile" className="text-xs font-bold text-cyan-300">VIEW ALL →</Link></div><div className="mt-5 divide-y divide-white/5">{activity.map((item) => <div key={`${item.game}-${item.rival}`} className="grid grid-cols-[1fr_auto] gap-4 py-4 sm:grid-cols-[1.2fr_1fr_auto]"><div><p className="font-semibold text-white">{item.game}</p><p className="mt-1 text-xs text-slate-600">vs {item.rival}</p></div><p className={`hidden self-center text-sm font-bold sm:block ${item.color}`}>{item.result}</p><p className="self-center text-sm font-bold text-slate-300">{item.prize}</p></div>)}</div></section>
      </main>
    </GameShell>
  );
}
