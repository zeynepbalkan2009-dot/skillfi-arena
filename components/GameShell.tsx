"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnect } from "@/components/WalletConnect";
import { PixelFleetMotion } from "@/components/motion/PixelFleetMotion";

const navigation = [
  { href: "/dashboard", label: "Home", sub: "Command Deck", index: "01", glyph: "⌂" },
  { href: "/games", label: "Games", sub: "Game Lab", index: "02", glyph: "▣" },
  { href: "/challenges", label: "Play", sub: "Match Room", index: "03", glyph: "⚔" },
  { href: "/guilds", label: "Community", sub: "Guild Hall", index: "04", glyph: "◈" },
  { href: "/profile", label: "Profile", sub: "Player Profile", index: "05", glyph: "◎" },
] as const;

export function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = navigation.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? navigation[0];

  return (
    <div className="player-shell min-h-screen text-arena-text">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <aside className="player-sidebar fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r lg:flex lg:flex-col">
        <Link href="/" className="player-brand flex items-center gap-3 px-6 py-7" aria-label="SkillFi Arena home">
          <span className="player-brand__mark grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl font-black text-white">S</span>
          <span className="min-w-0">
            <span className="block font-display text-lg font-black leading-5 tracking-[-.04em]">SKILLFI</span>
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-[.22em] text-[#4f46e5]">Arena · Connect</span>
          </span>
        </Link>

        <div className="mx-5 mb-5 rounded-xl border border-[#e6e6e2] bg-white/80 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#7b8490]">Your current season</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm font-extrabold text-[#20242c]">Founders’ Pilot</span>
            <span className="rounded-md bg-[#eeedff] px-2 py-1 font-mono text-[9px] font-bold text-[#4f46e5]">S00</span>
          </div>
        </div>

        <nav className="px-3" aria-label="Player navigation">
          <p className="px-3 pb-3 pt-1 text-[9px] font-bold uppercase tracking-[.2em] text-[#8a9099]">Navigate</p>
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={`player-nav-item group relative my-1 flex items-center gap-3 rounded-xl px-3 py-3 transition-all ${active ? "player-nav-item--active" : ""}`}>
                <span className="player-nav-item__glyph grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg" aria-hidden="true">{item.glyph}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold">{item.label}</span>
                  <span className="mt-0.5 block text-[10px] opacity-65">{item.sub}</span>
                </span>
                {active && <span className="player-nav-item__arrow" aria-hidden="true">›</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-5 pb-5">
          <div className="player-sidebar__pilot overflow-hidden rounded-2xl border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[.16em]">Pilot status</span>
              <span className="h-2 w-2 rounded-full bg-[#4f46e5]" aria-label="Controlled pilot" />
            </div>
            <PixelFleetMotion compact label="SkillFi fleet status" />
            <p className="text-[11px] font-bold">Arc-01 · Controlled pilot</p>
            <p className="mt-1 text-[10px] leading-4 opacity-65">Practice stakes only. No real-value rewards.</p>
          </div>
          <p className="px-1 pt-4 text-[9px] font-medium text-[#969ba3]">SKILLFI ARENA © · SEASON 00</p>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="player-topbar sticky top-0 z-30 border-b backdrop-blur-xl">
          <div className="flex min-h-[70px] items-center justify-between gap-3 px-4 sm:px-7 xl:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/" className="player-brand-mobile flex items-center gap-2 lg:hidden" aria-label="SkillFi Arena home">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#4f46e5] text-base font-black text-white">S</span>
                <span className="font-display text-sm font-black tracking-tight">SKILLFI</span>
              </Link>
              <div className="hidden lg:block">
                <p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#9298a2]">Player station <span className="px-1 text-[#c5c8ce]">/</span> {current.sub}</p>
                <p className="mt-1 text-sm font-extrabold text-[#252a34]">{current.label}</p>
              </div>
              <nav className="hidden items-center gap-1 sm:flex lg:hidden" aria-label="Tablet navigation">
                {navigation.map((item) => <Link key={item.href} href={item.href} aria-current={pathname.startsWith(item.href) ? "page" : undefined} className="rounded-lg px-2 py-2 text-[11px] font-bold">{item.label}</Link>)}
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="hidden rounded-lg border border-[#e7e6e2] bg-white px-3 py-2 text-[10px] font-bold text-[#737b87] md:inline-flex"><span className="mr-2 text-[#4f46e5]">●</span> FOUNDERS’ PILOT</span>
              <Link href="/profile" className="hidden items-center gap-2 rounded-xl border border-[#e7e6e2] bg-white py-1.5 pl-1.5 pr-3 transition hover:border-[#b7b2ff] md:flex">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eeedff] text-sm font-black text-[#4f46e5]">P</span>
                <span className="text-xs font-bold text-[#353945]">Player profile</span>
              </Link>
              <WalletConnect />
            </div>
          </div>
          <nav className="player-mobile-nav grid grid-cols-5 border-t lg:hidden" aria-label="Mobile player navigation">
            {navigation.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-1 px-1 py-2 text-[9px] font-bold ${active ? "player-mobile-nav__active" : ""}`}><span className="text-base" aria-hidden="true">{item.glyph}</span><span className="truncate">{item.label}</span></Link>;
            })}
          </nav>
        </header>

        <div id="main-content" className="player-shell__canvas">{children}</div>
      </div>
    </div>
  );
}
