import type { Metadata } from "next";
import { InfoPageShell, InfoSection } from "@/components/InfoPageShell";

export const metadata: Metadata = { title: "Testnet Terms", description: "Pre-release testnet conditions for SkillFi Arena." };

export default function TermsPage() {
  return <InfoPageShell eyebrow="Pre-release conditions" title="Testnet terms" intro="SkillFi Arena is currently a development and testing product. These conditions are a plain-language interim notice, not final production terms.">
    <InfoSection title="Testnet only"><p>The product may be incomplete, interrupted, reset, or changed without notice. Test tokens have no promised monetary value. Do not send production assets to testnet contracts or addresses.</p></InfoSection>
    <InfoSection title="Eligibility"><p>Users must be legally capable of accepting applicable terms and must not use the product where prohibited. Age, geography, sanctions, skill-competition classification, and other eligibility controls will be finalized before real-value availability.</p></InfoSection>
    <InfoSection title="No investment or guaranteed outcome"><p>SkillFi is a software product for skill-based competition settlement. Nothing on the site is investment, financial, gambling, or legal advice. The product does not promise profit, returns, winnings, or continuous availability.</p></InfoSection>
    <InfoSection title="Acceptable use"><p>Users must not manipulate results, collude, exploit software, impersonate others, violate game rules or intellectual-property rights, interfere with service operation, or use the product for unlawful activity.</p></InfoSection>
    <InfoSection title="Risk"><p>Blockchain transactions may be irreversible. Smart contracts, wallets, networks, or third-party services may fail. A testnet demonstration and automated tests do not eliminate technical or legal risk.</p></InfoSection>
    <InfoSection title="Project status and final terms"><p>SkillFi Arena is currently a founder-led, pre-incorporation project. Operator identity and contact, governing law, dispute terms, liability provisions, fees, refund rules, complaint channels, and country-specific disclosures require counsel review and will be added before production launch. Entity information will be added if and when the project incorporates.</p></InfoSection>
    <p className="border-t border-white/5 pt-6 text-xs text-arena-muted">Last updated: 27 August 2026</p>
  </InfoPageShell>;
}
