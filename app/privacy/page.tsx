import type { Metadata } from "next";
import { InfoPageShell, InfoSection } from "@/components/InfoPageShell";

export const metadata: Metadata = { title: "Privacy Notice", description: "Pre-release privacy notice for the SkillFi Arena testnet product." };

export default function PrivacyPage() {
  return <InfoPageShell eyebrow="Controlled pilot notice" title="Privacy" intro="SkillFi Arena is a founder-led, pre-incorporation testnet project. This notice explains the limited information processed for the controlled pilot; it is not a production-service privacy policy.">
    <InfoSection title="Information used by the product"><p>The testnet application may process wallet addresses, authentication identifiers, profile details provided by users, challenge and match activity, transaction hashes, technical logs, security events, and support communications.</p></InfoSection>
    <InfoSection title="Why it is used"><p>Information is used to provide accounts and matches, verify authorization, reconcile onchain transactions, enforce safety limits, prevent abuse, troubleshoot failures, measure product performance, and comply with applicable obligations.</p></InfoSection>
    <InfoSection title="Public blockchain data"><p>Blockchain transactions are public and may remain available permanently. SkillFi cannot delete or alter information written to a public network. Users should not place personal information in transaction data.</p></InfoSection>
    <InfoSection title="Service providers"><p>The current pilot uses Privy for authentication and wallet onboarding, Supabase for hosted application data, Vercel for web hosting and operational logs, and Arc testnet plus wallet/RPC infrastructure for public test transactions. These providers may process technical data under their own terms and privacy notices.</p></InfoSection>
    <InfoSection title="Retention and minimization"><p>Pilot applications, consent records, gameplay measurements, and support or security records are retained for the pilot and evaluation period and may be kept for up to 12 months afterward for reliability, abuse prevention, grant evidence, and dispute documentation. Records may be deleted or anonymized earlier when no longer needed. Public blockchain records cannot be deleted by SkillFi.</p></InfoSection>
    <InfoSection title="Contact and rights"><p>Participants may request access, correction, withdrawal from the cohort, or deletion of eligible offchain pilot data through the founder&apos;s verified contact linked on the Pilot page. Some security, audit, or public-chain records may need to be retained. Do not submit identity documents, financial credentials, health data, or other sensitive personal information.</p></InfoSection>
    <p className="border-t border-white/5 pt-6 text-xs text-arena-muted">Notice version: 1 September 2026 · Production launch remains subject to a complete jurisdiction-specific privacy review.</p>
  </InfoPageShell>;
}
