import Link from "next/link";
import type { ReactNode } from "react";

export function InfoPageShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/5 bg-arena-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="SkillFi Arena home">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-arena-accent/30 bg-arena-accent/10 font-display text-lg font-bold text-arena-accent">S</span>
            <span className="font-display text-lg font-bold tracking-[0.12em] text-white">SKILLFI</span>
          </Link>
          <Link href="/#arena" className="rounded-lg border border-arena-border px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-arena-accent/40 hover:text-arena-accent">Open arena</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-arena-accent">{eyebrow}</p>
        <h1 className="mt-4 text-balance font-display text-4xl font-bold text-white sm:text-5xl">{title}</h1>
        <p className="mt-6 text-lg leading-8 text-slate-400">{intro}</p>
        <div className="prose-skillfi mt-12 space-y-10">{children}</div>
      </main>
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-3 px-5 py-8 text-xs text-arena-muted sm:px-8">
          <Link href="/about" className="hover:text-white">About</Link><Link href="/pilot" className="hover:text-white">Pilot</Link><Link href="/technology" className="hover:text-white">Technology</Link><Link href="/security" className="hover:text-white">Security</Link><Link href="/privacy" className="hover:text-white">Privacy</Link><Link href="/terms" className="hover:text-white">Terms</Link>
        </div>
      </footer>
    </div>
  );
}

export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="font-display text-2xl font-semibold text-white">{title}</h2><div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-400">{children}</div></section>;
}
