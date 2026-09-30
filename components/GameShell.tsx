"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnect } from "@/components/WalletConnect";
import { PixelFleetMotion } from "@/components/motion/PixelFleetMotion";

const navigation = [
  { href: "/dashboard", label: "Command deck", index: "01" },
  { href: "/games", label: "Game library", index: "02" },
  { href: "/challenges", label: "Match room", index: "03" },
  { href: "/guilds", label: "Guild hall", index: "04" },
] as const;

export function GameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="player-shell min-h-screen text-arena-text">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-arena-border bg-arena-surface shadow-[10px_0_30px_rgba(35,51,62,.07)] lg:flex lg:flex-col">
        <Link
          href="/"
          className="border-b border-arena-border px-7 py-7"
          aria-label="SkillFi home"
        >
          <span className="font-display text-xl font-bold tracking-[0.1em] text-arena-text">
            SKILLFI
          </span>
          <span className="ml-2 text-xs font-medium text-arena-accent">ARENA</span>
        </Link>

        <nav className="px-4 py-6" aria-label="Player navigation">
          <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-arena-muted">
            Player station
          </p>
          {navigation.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center border-t border-arena-border px-3 py-4 text-sm transition-colors last:border-b ${
                  active
                    ? "bg-[#e3f1f5] text-arena-accent"
                    : "text-arena-muted hover:bg-[#f1f4f3] hover:text-arena-text"
                }`}
              >
                <span
                  className={`mr-4 font-mono text-[10px] ${
                    active ? "text-arena-accent" : "text-arena-muted"
                  }`}
                >
                  {item.index}
                </span>
                <span className="font-medium">{item.label}</span>
                {active && (
                  <span
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-arena-accent"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-arena-border px-7 py-6">
          <PixelFleetMotion compact label="SkillFi fleet status" />
          <div className="flex items-center gap-2 text-[11px] text-arena-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            Pilot shard: Arc-01
          </div>
          <p className="mt-3 text-xs leading-5 text-arena-muted">
            Season 00 · practice stakes only
          </p>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="player-shell__toolbar sticky top-0 z-30 border-b backdrop-blur-lg">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-7">
            <Link
              href="/"
              className="font-display text-sm font-bold tracking-[0.12em] text-arena-text lg:hidden"
            >
              SKILLFI{" "}
              <span className="font-body font-normal tracking-normal text-arena-muted">Arena</span>
            </Link>

            <nav
              className="hidden items-center gap-6 text-xs sm:flex lg:hidden"
              aria-label="Tablet player navigation"
            >
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                  className={
                    pathname.startsWith(item.href)
                      ? "font-semibold text-arena-accent"
                      : "text-arena-muted hover:text-arena-text"
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <p className="hidden text-xs text-arena-muted lg:block">
              Season 00 {"//"} player station
            </p>

            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                className="hidden border border-arena-border px-3 py-2 text-xs font-medium text-arena-text transition-colors hover:border-arena-accent hover:text-arena-accent md:block"
              >
                Profile
              </Link>
              <WalletConnect />
            </div>
          </div>

          <nav
            className="grid grid-cols-4 border-t border-arena-border sm:hidden"
            aria-label="Mobile player navigation"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                className={`py-2 text-center text-[10px] ${
                  pathname.startsWith(item.href)
                    ? "bg-[#e3f1f5] font-semibold text-arena-accent"
                    : "text-arena-muted"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <div id="main-content" className="player-shell__canvas">{children}</div>
      </div>
    </div>
  );
}
