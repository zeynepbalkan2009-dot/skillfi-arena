import type { Metadata } from "next";
import { InfoPageShell, InfoSection } from "@/components/InfoPageShell";

export const metadata: Metadata = { title: "Security", description: "SkillFi Arena security model and responsible disclosure guidance." };

export default function SecurityPage() {
  return <InfoPageShell eyebrow="Security" title="Explicit state. Minimal trust." intro="SkillFi is designed around non-custodial match escrow, server-verified identity, auditable lifecycle events, and recoverable reconciliation between application and chain state.">
    <InfoSection title="Current controls"><ul className="list-disc space-y-2 pl-5"><li>Equal-stake escrow with explicit create, deposit, start, settle, cancel, refund, and payout states.</li><li>Authorization checks for match operations and result submission.</li><li>Idempotent transaction and audit records to make retries safe.</li><li>Server-side validation for authenticated writes; public clients receive restricted data.</li><li>Stake reservation and daily-limit foundations before real-value use.</li><li>Contract tests covering expected flows and adversarial edge cases.</li></ul></InfoSection>
    <InfoSection title="Before mainnet"><p>The project will require an independent smart-contract review, resolution of all critical and high-severity findings, secure operator-key procedures, monitoring, incident response, and jurisdiction-specific launch controls. Testnet validation is not a substitute for an audit.</p></InfoSection>
    <InfoSection title="Responsible disclosure"><p>Do not test against real users, attempt social engineering, access private data, or move funds. A dedicated disclosure address and response policy will be published before the public pilot. Until then, report issues through the verified project contact supplied with the demo.</p></InfoSection>
  </InfoPageShell>;
}
