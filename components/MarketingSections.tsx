import Link from "next/link";
import { PixelFleetMotion } from "@/components/motion/PixelFleetMotion";

const SESSION_STEPS = [
  ["01", "Choose", "Pick one of five measurable pilot games."],
  ["02", "Match", "Enter a queue with the same rules and round data."],
  ["03", "Play", "Complete the deterministic skill challenge."],
  ["04", "Record", "Review the submitted result and verification trail."],
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
    title: "Pick a measurable game",
    body: "Every pilot game has a fixed objective, explicit scoring rules and a result that can be inspected.",
  },
  {
    number: "02",
    title: "Enter a controlled queue",
    body: "Participants receive the same match parameters. Capacity, regions and access remain limited during the pilot.",
  },
  {
    number: "03",
    title: "Play a shared round",
    body: "The platform records the attempt, validates the outcome and keeps the match history available for review.",
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-arena-accent">
            Controlled pilot · Arc Testnet
          </p>
          <h1
            id="hero-title"
            className="mt-7 max-w-3xl font-display text-5xl font-bold leading-[0.98] tracking-[-0.045em] text-white sm:text-7xl"
          >
            Skill should be visible in the result.
          </h1>
          <p className="mt-8 max-w-xl text-base leading-7 text-arena-muted sm:text-lg">
            SkillFi Arena is a competitive-play pilot built around five
            deterministic games, shared rounds and outcomes participants can
            inspect.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/games"
              className="bg-arena-accent px-5 py-3 text-sm font-bold text-arena-bg transition hover:bg-cyan-300"
            >
              Explore the games
            </Link>
            <Link
              href="/pilot"
              className="border-b border-arena-muted pb-1 text-sm font-semibold text-white transition hover:border-arena-accent hover:text-arena-accent"
            >
              Read the pilot brief →
            </Link>
          </div>
          <p className="mt-7 max-w-xl text-xs leading-5 text-arena-muted">
            Testnet pilot only. Participation does not promise cash, tokens or
            other real-value rewards.
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
                Session anatomy
              </p>
              <p className="mt-2 font-display text-xl font-semibold text-white">
                One round, four clear states
              </p>
            </div>
            <span className="text-xs text-arena-accent">TEST / 01</span>
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
              How it works
            </p>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Fewer promises. More observable states.
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
              Verification path
            </p>
            <h2 className="mt-5 font-display text-3xl font-bold text-white">
              Designed to be checked.
            </h2>
          </div>
          <div className="max-w-2xl text-base leading-7 text-arena-muted">
            <p>
              A match moves through explicit queue, play, submission and result
              states. The pilot focuses on whether those states remain
              consistent across two players and whether disputes can be
              investigated from recorded evidence.
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
              Inspect the architecture →
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
            Pilot cohort
          </p>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Help test the competition, not the pitch.
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-7 text-arena-muted">
            We are preparing a limited cohort of players and game studios to
            test matchmaking, result verification and operational controls
            before a wider release.
          </p>
        </div>
        <Link
          href="/pilot"
          className="w-fit border border-arena-accent px-5 py-3 text-sm font-bold text-arena-accent transition hover:bg-arena-accent hover:text-arena-bg"
        >
          View pilot requirements
        </Link>
      </div>
    </section>
  );
}
