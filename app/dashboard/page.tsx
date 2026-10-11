import Link from "next/link";
import { GameShell } from "@/components/GameShell";
import { PilotJourneyCard } from "@/components/PilotJourneyCard";

const steps = [
  { index: "01", title: "Choose your game", copy: "Pick the skill you want to put to the test.", href: "/games", action: "Explore library", glyph: "▣" },
  { index: "02", title: "Find your match", copy: "Enter the challenge room and connect with another approved pilot player.", href: "/challenges", action: "Open Match Room", glyph: "⚔" },
  { index: "03", title: "Play & verify", copy: "Play a deterministic round and keep the result ready for review.", href: "/profile", action: "View player profile", glyph: "◎" },
] as const;

export default function DashboardPage() {
  return (
    <GameShell>
      <main className="mx-auto max-w-[1440px] px-3 py-4 sm:px-5 sm:py-6 xl:px-7">
        <section className="relative mb-7 overflow-hidden rounded-[22px] border border-[#e6e5df] bg-white">
          <div className="grid min-h-[370px] lg:grid-cols-[1.1fr_.9fr]">
            <div className="relative z-10 flex flex-col items-start justify-center p-6 sm:p-9 lg:p-12">
              <p className="launcher-kicker">Season 00 <span className="text-[#9a9ca6]">/ Founders’ Pilot</span></p>
              <h1 className="launcher-title mt-5 max-w-2xl font-display text-5xl font-black sm:text-6xl xl:text-7xl">Queue up.<br /><span className="text-[#5146e5]">Prove it.</span></h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[#6e7480]">A competitive playground for skill-based games. Find your next challenge, play a fair round, and verify the result.</p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/games" className="launcher-button-primary inline-flex min-h-12 items-center gap-5 px-6 text-sm font-extrabold">Explore games <span aria-hidden="true">↗</span></Link>
                <Link href="/challenges" className="inline-flex min-h-12 items-center gap-3 rounded-[10px] border border-[#e5e5df] bg-white px-5 text-sm font-bold text-[#373b47] transition hover:border-[#bdb8ff] hover:text-[#5146e5]">Enter Match Room <span aria-hidden="true">→</span></Link>
              </div>
              <p className="mt-6 text-[10px] font-semibold uppercase tracking-[.12em] text-[#9a9da5]">Controlled pilot <span className="px-1">·</span> Testnet only <span className="px-1">·</span> No real-value rewards</p>
            </div>
            <div className="dashboard-hero-art relative hidden min-h-[330px] overflow-hidden lg:block" aria-label="Abstract SkillFi Arena game artwork" role="img">
              <div className="dashboard-hero-art__orb dashboard-hero-art__orb--one" />
              <div className="dashboard-hero-art__orb dashboard-hero-art__orb--two" />
              <div className="dashboard-hero-art__ring dashboard-hero-art__ring--one" />
              <div className="dashboard-hero-art__ring dashboard-hero-art__ring--two" />
              <div className="dashboard-hero-art__tile dashboard-hero-art__tile--one">S</div>
              <div className="dashboard-hero-art__tile dashboard-hero-art__tile--two">↗</div>
              <div className="dashboard-hero-art__tile dashboard-hero-art__tile--three">✳</div>
              <div className="dashboard-hero-art__caption"><span className="h-2 w-2 rounded-full bg-[#b6f36b]" /><span>PLAYER STATION</span><span className="ml-auto text-white/60">S00 / ARC-01</span></div>
            </div>
          </div>
        </section>

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#e7e7e1] bg-white p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#9095a0]">Season</p>
            <div className="mt-3 flex items-end justify-between"><p className="font-display text-3xl font-black text-[#252833]">00</p><span className="rounded-lg bg-[#eeedff] px-2.5 py-1.5 text-[10px] font-extrabold text-[#5146e5]">FOUNDERS</span></div>
          </div>
          <div className="rounded-2xl border border-[#e7e7e1] bg-white p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#9095a0]">Environment</p>
            <div className="mt-3 flex items-end justify-between"><p className="font-display text-2xl font-black text-[#252833]">Arc Testnet</p><span className="mb-1 h-2 w-2 rounded-full bg-[#5146e5]" /></div>
          </div>
          <div className="rounded-2xl border border-[#e7e7e1] bg-white p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#9095a0]">Competition</p>
            <div className="mt-3 flex items-end justify-between"><p className="font-display text-2xl font-black text-[#252833]">Skill first</p><span className="text-lg text-[#5146e5]">✳</span></div>
          </div>
        </div>

        <section aria-labelledby="start-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="launcher-kicker">Get in the game</p><h2 id="start-heading" className="mt-2 font-display text-2xl font-black tracking-tight text-[#252833]">Your next move</h2></div>
            <span className="text-[10px] font-bold uppercase tracking-[.15em] text-[#9297a0]">Three steps to play</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {steps.map((step) => (
              <article key={step.index} className="group rounded-2xl border border-[#e7e7e1] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c8c4ff] hover:shadow-[0_12px_28px_rgba(52,47,130,.06)] sm:p-6">
                <div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eeedff] text-xl font-bold text-[#5146e5]">{step.glyph}</span><span className="font-mono text-xs font-bold text-[#a1a4ac]">{step.index}</span></div>
                <h3 className="mt-6 font-display text-xl font-black text-[#252833]">{step.title}</h3>
                <p className="mt-2 min-h-[48px] text-sm leading-6 text-[#777d88]">{step.copy}</p>
                <Link href={step.href} className="mt-5 inline-flex items-center gap-3 text-xs font-extrabold text-[#5146e5]">{step.action}<span className="transition group-hover:translate-x-1" aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border border-[#e7e7e1] bg-white p-5 sm:p-7">
            <p className="launcher-kicker">Pilot briefing</p>
            <h2 className="mt-3 font-display text-2xl font-black tracking-tight text-[#252833]">Built for fair competition.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#777d88]">Both players receive the same deterministic round. Match creation, result submission, and feedback remain inspectable during the controlled pilot.</p>
            <Link href="/pilot" className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-[#5146e5]">Read pilot rules <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="rounded-2xl border border-[#e7e7e1] bg-[#f0efff] p-5 sm:p-7">
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#6259b5]">Player station</p>
            <h2 className="mt-3 font-display text-2xl font-black tracking-tight text-[#282545]">Make it yours.</h2>
            <p className="mt-3 text-sm leading-6 text-[#6e6a8d]">Set up your player identity, connect your wallet, and keep track of your verified match history.</p>
            <Link href="/profile" className="mt-5 inline-flex min-h-10 items-center gap-4 rounded-lg bg-[#5146e5] px-4 text-xs font-extrabold text-white transition hover:bg-[#4037c9]">Open player profile <span aria-hidden="true">↗</span></Link>
          </div>
        </section>
        <div className="mt-8"><PilotJourneyCard /></div>
      </main>
    </GameShell>
  );
}
