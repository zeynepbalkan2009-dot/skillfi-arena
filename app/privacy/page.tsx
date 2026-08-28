import type { Metadata } from "next";
import { InfoPageShell, InfoSection } from "@/components/InfoPageShell";

export const metadata: Metadata = { title: "Privacy Notice", description: "Pre-release privacy notice for the SkillFi Arena testnet product." };

export default function PrivacyPage() {
  return <InfoPageShell eyebrow="Pre-release notice" title="Privacy" intro="SkillFi Arena is currently a pre-incorporation project. This notice describes the categories of information the testnet product may process and must be completed with a responsible operator, contact, retention periods, vendors, and jurisdiction-specific rights before public launch.">
    <InfoSection title="Information used by the product"><p>The testnet application may process wallet addresses, authentication identifiers, profile details provided by users, challenge and match activity, transaction hashes, technical logs, security events, and support communications.</p></InfoSection>
    <InfoSection title="Why it is used"><p>Information is used to provide accounts and matches, verify authorization, reconcile onchain transactions, enforce safety limits, prevent abuse, troubleshoot failures, measure product performance, and comply with applicable obligations.</p></InfoSection>
    <InfoSection title="Public blockchain data"><p>Blockchain transactions are public and may remain available permanently. SkillFi cannot delete or alter information written to a public network. Users should not place personal information in transaction data.</p></InfoSection>
    <InfoSection title="Service providers and retention"><p>The current stack uses third-party infrastructure for authentication, hosted data, wallet connectivity, and blockchain access. The final notice will name active providers and document retention and deletion rules before collecting pilot applications or enabling production use.</p></InfoSection>
    <InfoSection title="Contact and rights"><p>A verified privacy contact will be added before submission. Entity information will be added if and when the project incorporates. Users should not provide sensitive personal information while this pre-release notice is displayed.</p></InfoSection>
    <p className="border-t border-white/5 pt-6 text-xs text-arena-muted">Last updated: 27 August 2026</p>
  </InfoPageShell>;
}
