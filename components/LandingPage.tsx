import Link from "next/link";
import {
  MarketingDetails,
  MarketingHero,
  PilotSection,
} from "@/components/MarketingSections";
import { WalletConnect } from "@/components/WalletConnect";

const ROUTES = [
  {
    index: "01",
    title: "Game lab",
    body: "Meet the five Season 00 games, learn the rules and find your main.",
    href: "/games",
    action: "Pick a game",
  },
  {
    index: "02",
    title: "Command deck",
    body: "Your pilot access, recent runs and next move—without dashboard clutter.",
    href: "/dashboard",
    action: "Enter deck",
  },
  {
    index: "03",
    title: "Builder dock",
    body: "Bring a game into the arena and see exactly what it must prove first.",
    href: "/studio",
    action: "Dock a build",
  },
] as const;

export function LandingPage() {
  return (
    <div className="min-h-screen bg-arena-bg">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-arena-border bg-arena-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href="/"
            aria-label="SkillFi Arena home"
            className="flex items-baseline gap-2 text-white"
          >
            <span className="font-display text-base font-bold tracking-[0.14em]">
              SKILLFI
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-arena-muted">
              Arena
            </span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-7 text-sm text-arena-muted md:flex"
          >
            <a href="#how-it-works" className="hover:text-white">
              Match loop
            </a>
            <a href="#pilot" className="hover:text-white">
              Season 00
            </a>
            <Link href="/games" className="hover:text-white">
              Game lab
            </Link>
            <Link href="/technology" className="hover:text-white">
              Protocol
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="hidden text-sm font-semibold text-white hover:text-arena-accent sm:block"
            >
              Command deck
            </Link>
            <WalletConnect />
          </div>
        </div>
      </header>

      <main id="main-content">
        <MarketingHero />
        <MarketingDetails />

        <section
          aria-labelledby="routes-title"
          className="border-b border-arena-border"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-arena-accent">
                  Select station
                </p>
                <h2
                  id="routes-title"
                  className="mt-5 font-display text-3xl font-bold text-white sm:text-5xl"
                >
                  Where are you spawning?
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-arena-muted">
                Player, challenger or builder—the arena gives each role its own
                door instead of one endless dashboard.
              </p>
            </div>
            <div className="mt-14 border-t border-arena-border">
              {ROUTES.map((route) => (
                <Link
                  key={route.index}
                  href={route.href}
                  className="group grid gap-4 border-b border-arena-border py-7 transition hover:bg-white/[0.025] sm:grid-cols-[4rem_1fr_1fr_auto] sm:items-center sm:px-3"
                >
                  <span className="font-mono text-xs text-arena-accent">
                    {route.index}
                  </span>
                  <h3 className="font-display text-xl font-semibold text-white">
                    {route.title}
                  </h3>
                  <p className="max-w-md text-sm leading-6 text-arena-muted">
                    {route.body}
                  </p>
                  <span className="text-sm font-semibold text-white group-hover:text-arena-accent">
                    {route.action} →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <PilotSection />
      </main>

      <footer className="border-t border-arena-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-9 text-xs text-arena-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} SkillFi Arena · Season 00</p>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap gap-x-6 gap-y-3"
          >
            <Link href="/about" className="hover:text-white">
              About
            </Link>
            <Link href="/security" className="hover:text-white">
              Security
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
