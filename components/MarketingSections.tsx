import Link from "next/link";
import { PixelFleetMotion } from "@/components/motion/PixelFleetMotion";

const SESSION_STEPS = [
  ["01", "Pick your game", "Choose the skill you want on the line."],
  ["02", "Find a rival", "Both players enter with identical rules."],
  ["03", "Play the round", "No boosts. No mystery modifiers."],
  ["04", "Read the proof", "Score, round data and result stay inspectable."],
] as const;

const PROOF_POINTS = [
  ["05", "pilot games"],
  ["100", "cohort cap"],
  ["ARC", "test network"],
  ["0", "real-value rewards"],
] as const;

const FLOW = [
  {
    number: "01",
    title: "Choose your discipline",
    body: "Typing, memory, logic, arithmetic or pattern reading. Every game publishes its scoring rules before you queue.",
  },
  {
    number: "02",
    title: "Meet on equal ground",
    body: "You and your rival receive the same round parameters. The pilot keeps the field small enough to investigate every edge case.",
  },
  {
    number: "03",
    title: "Own the result",
    body: "Your attempt becomes a reviewable match record—not a vague badge, not a score that disappears when the screen closes.",
  },
] as const;

export function MarketingHero() {
  return (
    <section
      className="border-b border-arena-border"
      aria-labelledby="hero-title"
    >
      <div className="mx-auto grid max-w-6xl lg:grid-cols-[1.18fr_0.82fr]">
        <div className="px-5 py-20 sm:px-8 sm:py-28 lg:border-r lg:border-arena-border lg:pr-16">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em]">
            <span className="arena-live-dot text-[#b7ff4a]">Season 00 live</span>
            <span className="text-slate-600">//</span>
            <span className="text-arena-muted">Founders&apos; pilot · Arc</span>
          </div>
          <h1
            id="hero-title"
            className="mt-7 max-w-3xl font-display text-5xl font-bold leading-[0.98] tracking-[-0.045em] text-white sm:text-7xl"
          >
            Queue up.
            <span className="block text-arena-accent">Prove it.</span>
          </h1>
          <p className="mt-8 max-w-xl text-base leading-7 text-arena-muted sm:text-lg">
            Five original skill games. One rival. A result both sides can
            inspect. SkillFi is building the place where a clean win actually
            means something.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/games"
              className="bg-arena-accent px-5 py-3 text-sm font-bold text-arena-bg transition hover:bg-cyan-300"
            >
              Enter the game lab
            </Link>
            <Link
              href="/pilot"
              className="border-b border-arena-muted pb-1 text-sm font-semibold text-white transition hover:border-arena-accent hover:text-arena-accent"
            >
              Join Season 00 →
            </Link>
          </div>
          <p className="mt-7 max-w-xl text-xs leading-5 text-arena-muted">
            Season 00 is a testnet playtest. No entry fee, token sale or
            real-value prize pool.
          </p>
        </div>

        <aside
          className="px-5 py-14 sm:px-8 lg:py-20 lg:pl-12"
          aria-label="A pilot session"
        >
          <PixelFleetMotion label="An original SkillFi pixel fleet entering the arena" />
          <div className="flex items-end justify-between border-b border-arena-border pb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-arena-muted">
                Match protocol
              </p>
              <p className="mt-2 font-display text-xl font-semibold text-white">
                Your next run, decoded
              </p>
            </div>
            <span className="font-mono text-xs text-[#b7ff4a]">READY_01</span>
          </div>
          <ol>
            {SESSION_STEPS.map(([number, title, body]) => (
              <li
                key={number}
                className="grid grid-cols-[3rem_1fr] gap-3 border-b border-arena-border py-5"
              >
                <span className="font-mono text-xs text-arena-accent">
                  {number}
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-arena-muted">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <div className="arena-broadcast" aria-label="Season zero game roster">
        <div className="arena-broadcast__track">
          <span>TYPING SPRINT</span><i>◆</i><span>ARITHMETIC RUSH</span><i>◆</i>
          <span>SEQUENCE RECALL</span><i>◆</i><span>PATTERN LOCK</span><i>◆</i>
          <span>LOGIC GRID</span><i>◆</i>
          <span aria-hidden="true">TYPING SPRINT</span><i aria-hidden="true">◆</i>
          <span aria-hidden="true">ARITHMETIC RUSH</span><i aria-hidden="true">◆</i>
          <span aria-hidden="true">SEQUENCE RECALL</span><i aria-hidden="true">◆</i>
          <span aria-hidden="true">PATTERN LOCK</span><i aria-hidden="true">◆</i>
          <span aria-hidden="true">LOGIC GRID</span><i aria-hidden="true">◆</i>
        </div>
      </div>

      <dl className="mx-auto grid max-w-6xl grid-cols-2 border-x border-arena-border sm:grid-cols-4">
        {PROOF_POINTS.map(([value, label], index) => (
          <div
            key={label}
            className={`px-5 py-6 sm:px-7 ${index > 0 ? "border-l border-arena-border" : ""}`}
          >
            <dt className="text-xs uppercase tracking-[0.16em] text-arena-muted">
              {label}
            </dt>
            <dd className="mt-2 font-display text-2xl font-bold text-white">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function MarketingDetails() {
  return (
    <>
      <section
        id="how-it-works"
        className="scroll-mt-24 border-b border-arena-border"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-arena-accent">
              Match loop
            </p>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              No pay-to-win fog. Just the run.
            </h2>
          </div>
          <ol className="mt-14 grid border-y border-arena-border md:grid-cols-3">
            {FLOW.map((item, index) => (
              <li
                key={item.number}
                className={`py-8 md:px-8 ${index > 0 ? "border-t border-arena-border md:border-l md:border-t-0" : ""}`}
              >
                <span className="font-mono text-xs text-arena-accent">
                  {item.number}
                </span>
                <h3 className="mt-8 font-display text-xl font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-arena-muted">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="technology"
        className="scroll-mt-24 border-b border-arena-border"
      >
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-arena-accent">
              After the final input
            </p>
            <h2 className="mt-5 font-display text-3xl font-bold text-white">
              The scoreboard keeps receipts.
            </h2>
          </div>
          <div className="max-w-2xl text-base leading-7 text-arena-muted">
            <p>
              Every match moves through a visible queue, play, submission and
              result trail. If two players disagree, the answer should come
              from recorded evidence—not whoever shouts loudest in chat.
            </p>
            <p className="mt-6 border-l-2 border-arena-accent pl-5 text-sm text-arena-text">
              Value-bearing settlement infrastructure is not part of the current
              public pilot. It remains gated behind product, security and legal
              release reviews.
            </p>
            <Link
              href="/technology"
              className="mt-8 inline-block text-sm font-semibold text-white underline decoration-arena-muted underline-offset-4 hover:decoration-arena-accent"
            >
              Open the protocol notes →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export function PilotSection() {
  return (
    <section id="pilot" className="scroll-mt-24 bg-[#0d141b]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end lg:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-arena-accent">
            Founding players
          </p>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Leave your fingerprints on Season 00.
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-7 text-arena-muted">
            The first 100 players are not background traffic. You will break
            queues, expose unfair edges and help decide what deserves to enter
            the next season.
          </p>
        </div>
        <Link
          href="/pilot"
          className="w-fit border border-arena-accent px-5 py-3 text-sm font-bold text-arena-accent transition hover:bg-arena-accent hover:text-arena-bg"
        >
          Claim a pilot slot
        </Link>
      </div>
    </section>
  );
}
