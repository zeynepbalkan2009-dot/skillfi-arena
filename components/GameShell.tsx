"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnect } from "@/components/WalletConnect";

const navigation = [
  { href: "/dashboard", label: "Command Center", mark: "⌂" },
  { href: "/games", label: "Game Library", mark: "▦" },
  { href: "/challenges", label: "Challenges", mark: "⚔" },
  { href: "/guilds", label: "Guild Wars", mark: "⬢" },
];

export function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#07090d] text-slate-100">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_76%_8%,rgba(99,102,241,0.13),transparent_28rem),radial-gradient(circle_at_15%_88%,rgba(34,211,238,0.08),transparent_24rem)]" />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/7 bg-[#0b0e14]/95 px-4 py-5 backdrop-blur-xl lg:flex lg:flex-col">
        <Link href="/" className="flex items-center gap-3 px-2" aria-label="SkillFi home">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-indigo-500 font-display text-xl font-black text-[#07090d]">S</span>
          <div><p className="font-display text-lg font-bold tracking-[0.12em]">SKILLFI</p><p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Battle Network</p></div>
        </Link>
        <p className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-600">Play</p>
        <nav className="mt-3 space-y-1" aria-label="Player navigation">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <Link key={item.href} href={item.href} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${active ? "bg-white/10 text-white shadow-[inset_3px_0_0_#22d3ee]" : "text-slate-500 hover:bg-white/5 hover:text-slate-200"}`}><span className={`grid h-7 w-7 place-items-center rounded-lg text-base ${active ? "bg-cyan-300/15 text-cyan-300" : "bg-white/5 group-hover:text-slate-300"}`}>{item.mark}</span>{item.label}{item.label === "Challenges" && <span className="ml-auto rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">LIVE</span>}</Link>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-indigo-400/15 bg-gradient-to-br from-indigo-500/10 to-cyan-400/5 p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-bold text-indigo-200">ARC SEASON 01</span><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /></div>
          <p className="mt-3 font-display text-2xl font-bold">12D 08H</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Guild ranking locks at season end. Every verified win counts.</p>
        </div>
      </aside>

      <div className="relative lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/7 bg-[#090c11]/85 px-4 backdrop-blur-xl sm:px-7">
          <nav className="flex items-center gap-1 lg:hidden" aria-label="Mobile player navigation">{navigation.map((item) => <Link key={item.href} href={item.href} aria-label={item.label} className={`grid h-9 w-9 place-items-center rounded-lg ${pathname === item.href ? "bg-cyan-300/15 text-cyan-300" : "text-slate-500"}`}>{item.mark}</Link>)}</nav>
          <div className="hidden items-center gap-2 text-xs text-slate-500 lg:flex"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Arc Testnet operational</div>
          <div className="flex items-center gap-3"><Link href="/profile" className="hidden rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-white/20 sm:block">Player profile</Link><WalletConnect /></div>
        </header>
        {children}
      </div>
    </div>
  );
}
