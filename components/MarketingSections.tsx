export function MarketingHero() {
  const arcIsActive = process.env.NEXT_PUBLIC_CHAIN_TARGET === "arcTestnet";
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute inset-0 bg-arena-grid [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="pointer-events-none absolute left-1/2 top-12 h-72 w-72 -translate-x-1/2 rounded-full bg-arena-accent/10 blur-[100px]" />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-32">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-arena-accent/20 bg-arena-accent/5 px-3 py-1.5 text-xs font-medium text-arena-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-arena-win shadow-[0_0_10px_#34d399]" /> {arcIsActive ? "Live on Arc Testnet" : "Arc-native settlement in development"}
            </div>
            <h1 className="text-balance font-display text-5xl font-bold leading-[0.98] tracking-[-0.025em] text-white sm:text-6xl lg:text-7xl">
              Play on skill.<br /><span className="text-arena-accent">Settle in USDC.</span>
            </h1>
            <p className="mt-7 max-w-xl text-balance text-lg leading-8 text-slate-400">
              SkillFi Arena turns competitive matches into transparent peer-to-peer payment agreements—with equal deposits, non-custodial escrow, and verifiable settlement.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="/dashboard" className="rounded-lg bg-arena-accent px-6 py-3 text-center text-sm font-bold text-arena-bg transition hover:-translate-y-0.5 hover:bg-cyan-300">Enter the arena</a>
              <a href="#technology" className="rounded-lg border border-arena-border bg-white/[0.03] px-6 py-3 text-center text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-white/[0.06]">Explore the protocol</a>
            </div>
            <p className="mt-5 text-xs leading-5 text-arena-muted">Testnet product. No promise of returns. Availability is subject to eligibility and applicable law.</p>
          </div>
          <SettlementPreview />
        </div>
      </section>
      <section className="border-b border-white/5 bg-white/[0.015]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-white/5 px-5 sm:px-8 md:grid-cols-4 md:divide-y-0">
          <ProofStat value="48" label="contract tests" /><ProofStat value="ARC" label="testnet deployed" /><ProofStat value="6" label="decimal-safe USDC" /><ProofStat value="0" label="residual Base test escrow" />
        </div>
      </section>
    </>
  );
}

export function MarketingDetails() {
  return (
    <>
      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <SectionHeading eyebrow="The flow" title="From challenge to settlement" description="A simple competitive experience backed by explicit onchain state—not a black-box balance." />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <FeatureCard number="01" title="Create & fund" copy="A player sets the game, rules, and equal USDC entry amount. Funds move into non-custodial match escrow." />
          <FeatureCard number="02" title="Compete & verify" copy="Both players compete under agreed rules. Authorized result handling links the game outcome to settlement." />
          <FeatureCard number="03" title="Settle transparently" copy="The contract executes payout or refund logic while immutable events keep the lifecycle auditable." />
        </div>
      </section>
      <section id="technology" className="border-y border-white/5 bg-white/[0.015]">
        <div className="mx-auto grid max-w-6xl gap-14 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading eyebrow="Built for programmable money" title="Arc at the center of value" description="SkillFi escrow is live on Arc Testnet with canonical USDC. Public runs have completed payout, cancellation/refund, and participant dispute/arbiter resolution paths with zero residual escrow balance." />
            <div className="mt-8 space-y-4"><TechRow title="Arc" copy="Deterministic home for match settlement and protocol activity." /><TechRow title="USDC" copy="Stable unit of account across deposits, refunds, and payouts." /><TechRow title="Circle stack" copy="Wallet onboarding and crosschain liquidity pathways under evaluation." /></div>
          </div>
          <ValueFlow />
        </div>
      </section>
    </>
  );
}

export function PilotSection() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const contactHref = contactEmail
    ? `mailto:${contactEmail}?subject=SkillFi%20Arena%20Pilot`
    : "/pilot";

  return (
    <section className="border-t border-white/5">
      <div className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-arena-accent">Pilot partners</p>
        <h2 className="mx-auto mt-4 max-w-2xl text-balance font-display text-4xl font-bold text-white">Help shape fair, global competitive settlement.</h2>
        <p className="mx-auto mt-4 max-w-xl text-arena-muted">We are inviting esports communities, university clubs, and tournament operators to join the Arc testnet pilot.</p>
        <a href={contactEmail ? contactHref : "/pilot"} className="mt-8 inline-flex rounded-lg border border-arena-accent/40 bg-arena-accent/10 px-6 py-3 text-sm font-bold text-arena-accent transition hover:bg-arena-accent hover:text-arena-bg">Become a pilot partner</a>
      </div>
    </section>
  );
}

function SettlementPreview() {
  return <div className="relative mx-auto w-full max-w-lg"><div className="absolute -inset-12 rounded-full bg-arena-accent/10 blur-3xl" /><div className="glass-panel relative rounded-2xl border border-white/10 p-5 shadow-2xl shadow-black/40"><div className="flex items-center justify-between border-b border-white/5 pb-4"><div><p className="text-xs uppercase tracking-[0.2em] text-arena-muted">Settlement preview</p><p className="mt-1 font-display text-xl font-semibold text-white">1v1 Skill Match</p></div><span className="rounded-full border border-arena-win/20 bg-arena-win/10 px-2.5 py-1 text-xs font-semibold text-arena-win">Escrow ready</span></div><div className="my-7 flex items-center justify-around"><Player label="Player A" color="cyan" /><span className="font-display text-sm font-bold tracking-widest text-arena-muted">VS</span><Player label="Player B" color="green" /></div><div className="rounded-xl border border-white/5 bg-black/20 p-4"><div className="flex justify-between text-sm"><span className="text-arena-muted">Equal deposits</span><span className="font-semibold text-white">10 + 10 USDC</span></div><div className="mt-4 flex justify-between text-[11px] text-arena-muted"><span className="text-arena-accent">● Fund</span><span>○ Play</span><span>○ Verify</span><span>○ Settle</span></div></div><div className="mt-4 flex justify-between text-xs text-arena-muted"><span>USDC settlement</span><span>Transparent · Auditable</span></div></div></div>;
}

function Player({ label, color }: { label: string; color: "cyan" | "green" }) { return <div className="text-center"><div className={`mx-auto grid h-14 w-14 place-items-center rounded-xl border font-display text-lg font-bold ${color === "cyan" ? "border-arena-accent/30 bg-arena-accent/10 text-arena-accent" : "border-arena-win/30 bg-arena-win/10 text-arena-win"}`}>{label.slice(-1)}</div><p className="mt-2 text-xs text-slate-300">{label}</p></div>; }
function ProofStat({ value, label }: { value: string; label: string }) { return <div className="px-4 py-8 text-center"><p className="font-display text-3xl font-bold text-white">{value}</p><p className="mt-1 text-xs uppercase tracking-wider text-arena-muted">{label}</p></div>; }
function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-arena-accent">{eyebrow}</p><h2 className="mt-4 text-balance font-display text-4xl font-bold text-white sm:text-5xl">{title}</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-arena-muted">{description}</p></div>; }
function FeatureCard({ number, title, copy }: { number: string; title: string; copy: string }) { return <article className="rounded-2xl border border-white/10 bg-arena-surface p-6 transition hover:-translate-y-1 hover:border-arena-accent/30"><p className="font-display text-sm font-bold text-arena-accent">{number}</p><h3 className="mt-8 font-display text-2xl font-semibold text-white">{title}</h3><p className="mt-3 leading-7 text-arena-muted">{copy}</p></article>; }
function TechRow({ title, copy }: { title: string; copy: string }) { return <div className="flex gap-4 rounded-xl border border-white/5 bg-arena-surface/70 p-4"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-arena-accent shadow-[0_0_10px_rgba(34,211,238,.8)]" /><div><p className="font-semibold text-white">{title}</p><p className="mt-1 text-sm leading-6 text-arena-muted">{copy}</p></div></div>; }
function ValueFlow() { return <div className="rounded-2xl border border-white/10 bg-arena-surface p-6"><p className="text-xs uppercase tracking-[0.2em] text-arena-muted">Value architecture</p><div className="mt-6 space-y-3"><FlowNode label="Player wallets" note="Equal USDC deposits" /><p className="text-center text-arena-accent">↓</p><FlowNode label="SkillFi escrow on Arc" note="Rules · state · reconciliation" active /><p className="text-center text-arena-accent">↓</p><div className="grid grid-cols-2 gap-3"><FlowNode label="Winner payout" note="Verified result" /><FlowNode label="Player refunds" note="Cancelled flow" /></div></div></div>; }
function FlowNode({ label, note, active = false }: { label: string; note: string; active?: boolean }) { return <div className={`rounded-xl border p-4 text-center ${active ? "border-arena-accent/40 bg-arena-accent/10 shadow-arena-glow" : "border-white/10 bg-black/20"}`}><p className="font-display font-semibold text-white">{label}</p><p className="mt-1 text-xs text-arena-muted">{note}</p></div>; }
