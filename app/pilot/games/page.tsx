import type { Metadata } from "next";
import Link from "next/link";
import { GameShell } from "@/components/GameShell";
import { PilotGameLab } from "@/components/PilotGameLab";

export const metadata: Metadata = { title: "Five-game pilot lab", description: "Test five original, deterministic SkillFi Arena skill games without real-value stakes." };

export default function PilotGamesPage() { return <GameShell><main className="mx-auto max-w-6xl px-4 py-10 sm:px-7"><p className="text-xs font-bold uppercase tracking-[.2em] text-arena-accent">Final pilot lab</p><h1 className="mt-2 font-display text-4xl font-black uppercase italic">Five playable skill games</h1><p className="mt-3 max-w-3xl text-arena-muted">These original prototypes use deterministic prompts and measurable answers. This lab deliberately does not create blockchain transactions, accept stakes, or award prizes; it is the safe functional-testing layer before a controlled 100-person test.</p><div className="mt-8"><PilotGameLab /></div><div className="mt-8 rounded-xl border border-amber-400/30 bg-amber-400/5 p-5 text-sm text-amber-100"><strong>Pre-release boundary:</strong> Original mechanics and test-only operation reduce intellectual-property and wagering risk, but do not constitute a legal opinion. Real-value or public launch remains blocked pending jurisdiction-specific counsel, final terms, privacy controls, and age/region enforcement.</div><Link href="/pilot" className="mt-6 inline-flex text-sm font-semibold text-arena-accent">← Pilot overview</Link></main></GameShell>; }
