import type { Metadata } from "next";
import Link from "next/link";
import { InfoPageShell, InfoSection } from "@/components/InfoPageShell";
import { PilotEnrollmentClient } from "@/components/PilotEnrollmentClient";

export const metadata: Metadata = {
  title: "Arc Testnet Pilot",
  description:
    "Join the SkillFi Arena controlled testnet pilot for esports communities and tournament organizers.",
};

export default function PilotPage() {
  return (
    <InfoPageShell
      eyebrow="Arc testnet pilot / Cohort 01"
      title="Test the competition with us."
      intro="A controlled, 100-player product trial for evaluating five deterministic games, matchmaking and result verification. Testnet only; no real deposits, prizes or promised rewards."
    >
      <InfoSection title="Pilot at a glance">
        <dl className="grid grid-cols-2 border-y border-arena-border sm:grid-cols-4">
          <Metric value="05" label="playable games" />
          <Metric value="100" label="cohort cap" />
          <Metric value="ARC" label="test network" />
          <Metric value="0" label="real assets" />
        </dl>
        <p className="text-xs text-slate-600">
          Capacity and completion figures are operational targets, not traction
          claims.
        </p>
      </InfoSection>
      <InfoSection title="Who it is for">
        <div className="border-t border-arena-border">
          <PilotRow
            index="01"
            title="Gaming communities"
            copy="Groups that regularly organize 1v1 challenges or small competitive events."
          />
          <PilotRow
            index="02"
            title="University clubs"
            copy="Student-led gaming and technology communities interested in testnet product trials."
          />
          <PilotRow
            index="03"
            title="Tournament operators"
            copy="Organizers who can evaluate result, dispute and operational workflows."
          />
          <PilotRow
            index="04"
            title="Creators and coaches"
            copy="Community leaders who can recruit testers and provide structured feedback."
          />
        </div>
      </InfoSection>
      <InfoSection title="What partners do">
        <ul className="list-disc space-y-2 pl-5">
          <li>Nominate a small group of eligible adult testers.</li>
          <li>Run structured matches using testnet USDC only.</li>
          <li>
            Report onboarding, funding, match, refund, and settlement friction.
          </li>
          <li>Join one kickoff and one retrospective session.</li>
          <li>
            Allow anonymized aggregate metrics to appear in the grant pilot
            report.
          </li>
        </ul>
      </InfoSection>
      <InfoSection title="What SkillFi provides">
        <ul className="list-disc space-y-2 pl-5">
          <li>Guided onboarding and pilot documentation.</li>
          <li>
            A controlled test environment with no requirement to deposit real
            funds.
          </li>
          <li>Direct issue triage during the pilot window.</li>
          <li>A partner summary with findings and proposed improvements.</li>
          <li>
            Optional acknowledgement as a design partner, only with written
            approval.
          </li>
        </ul>
      </InfoSection>
      <InfoSection title="How success is measured">
        <p>
          We will evaluate successful onboarding, completed two-player sessions,
          repeat participation, result consistency and actionable issue reports.
          These are future pilot targets, not current traction claims.
        </p>
      </InfoSection>
      <InfoSection title="Apply for controlled access">
        <PilotEnrollmentClient />
      </InfoSection>
      <InfoSection title="Direct contact">
        <p>
          Review the product and connect with founder Zeynep Balkan through her
          verified professional profile. No partner name or logo will be
          published without explicit written permission.
        </p>
        <p>
          <a
            className="inline-flex border-b border-arena-accent pb-1 font-semibold text-arena-accent hover:text-cyan-200"
            href="https://www.linkedin.com/in/zeynep-balkan-3709a8193"
            target="_blank"
            rel="noreferrer"
          >
            Contact the founder on LinkedIn →
          </a>
        </p>
      </InfoSection>
      <nav
        aria-label="Pilot resources"
        className="flex flex-wrap gap-x-7 gap-y-3 py-10"
      >
        <Link
          className="text-sm font-semibold text-arena-accent hover:text-cyan-300"
          href="/pilot/games"
        >
          Test all five pilot games →
        </Link>
        <Link
          className="text-sm font-semibold text-arena-accent hover:text-cyan-300"
          href="/pilot/runbook"
        >
          Review the session runbook →
        </Link>
        <Link
          className="text-sm font-semibold text-arena-accent hover:text-cyan-300"
          href="/technology"
        >
          Review the architecture →
        </Link>
      </nav>
    </InfoPageShell>
  );
}

function PilotRow({
  index,
  title,
  copy,
}: {
  index: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="grid gap-2 border-b border-arena-border py-4 sm:grid-cols-[3rem_12rem_1fr]">
      <span className="font-mono text-xs text-arena-accent">{index}</span>
      <p className="font-semibold text-white">{title}</p>
      <p className="text-sm leading-6 text-arena-muted">{copy}</p>
    </div>
  );
}
function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-l border-arena-border px-3 py-5 first:border-l-0 sm:px-5">
      <p className="font-display text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-arena-muted">
        {label}
      </p>
    </div>
  );
}
