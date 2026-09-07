import Link from "next/link";
import type { ReactNode } from "react";

export function InfoPageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-arena-bg">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="border-b border-arena-border bg-arena-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="flex items-baseline gap-2"
            aria-label="SkillFi Arena home"
          >
            <span className="font-display text-base font-bold tracking-[0.14em] text-white">
              SKILLFI
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-arena-muted">
              Arena
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="border-b border-arena-muted pb-1 text-sm font-semibold text-slate-200 transition hover:border-arena-accent hover:text-arena-accent"
          >
            Open workspace →
          </Link>
        </div>
      </header>
      <main id="main-content">
        <div className="border-b border-arena-border">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-arena-accent">
              {eyebrow}
            </p>
            <h1 className="mt-5 max-w-4xl text-balance font-display text-4xl font-bold tracking-[-0.035em] text-white sm:text-6xl">
              {title}
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-400">
              {intro}
            </p>
          </div>
        </div>
        <div className="prose-skillfi mx-auto max-w-6xl space-y-0 px-5 sm:px-8">
          {children}
        </div>
      </main>
      <footer className="border-t border-arena-border">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-3 px-5 py-8 text-xs text-arena-muted sm:px-8">
          <Link href="/about" className="hover:text-white">
            About
          </Link>
          <Link href="/pilot" className="hover:text-white">
            Pilot
          </Link>
          <Link href="/technology" className="hover:text-white">
            Technology
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
        </div>
      </footer>
    </div>
  );
}

export function InfoSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-6 border-b border-arena-border py-12 sm:py-16 lg:grid-cols-[15rem_1fr] lg:gap-12">
      <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
      <div className="max-w-3xl space-y-4 text-[15px] leading-7 text-slate-400">
        {children}
      </div>
    </section>
  );
}
