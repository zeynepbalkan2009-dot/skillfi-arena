"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useSkillFiUser } from "@/components/AuthSync";

type Enrollment = { status: "applied" | "active" | "completed" | "withdrawn" | "rejected"; created_at: string };

export function PilotEnrollmentClient() {
  const { authenticated, getAccessToken, login } = usePrivy();
  const { profile, loading: profileLoading } = useSkillFiUser();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const headers = useCallback(async (): Promise<Record<string, string>> => {
    const token = authenticated ? await getAccessToken() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [authenticated, getAccessToken]);

  const load = useCallback(async () => {
    const response = await fetch("/api/pilot/enroll", { headers: await headers(), cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setEnrollment(data.enrollment ?? null); setActive(data.capacity?.active ?? 0); }
    else setMessage(data.error ?? "Pilot status could not be loaded.");
    setLoading(false);
  }, [headers]);

  useEffect(() => { if (!profileLoading) void load(); }, [profileLoading, load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authenticated) { login(); return; }
    if (!profile) { setMessage("Complete your player profile before applying."); return; }
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    const response = await fetch("/api/pilot/enroll", { method: "POST", headers: { "Content-Type": "application/json", ...(await headers()) }, body: JSON.stringify({ adultAttested: form.get("adult") === "on", termsAccepted: form.get("terms") === "on", privacyAccepted: form.get("privacy") === "on" }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false); setMessage(response.ok ? "Application received. Access remains locked until manual review." : data.error ?? "Application failed.");
    if (response.ok) await load();
  }

  return <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[.05] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Controlled beta cohort</p><h3 className="mt-2 text-xl font-bold text-white">100-player test access</h3></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">{loading ? "Syncing…" : `${active}/100 active`}</span></div>
    {enrollment ? <EnrollmentStatus enrollment={enrollment}/> : <form onSubmit={submit} className="mt-5 space-y-3"><p className="text-sm leading-6 text-slate-400">Apply with your existing SkillFi profile. This pilot has no real deposits, prizes, lending, or production-value transfers.</p><Consent name="adult">I attest that I am at least 18 years old and eligible to participate where I live.</Consent><Consent name="terms">I accept the current pilot terms and understand this is a testnet product trial.</Consent><Consent name="privacy">I have read the privacy notice and consent to pilot telemetry and anonymized aggregate reporting.</Consent><button disabled={busy} className="mt-2 rounded-lg bg-cyan-300 px-5 py-3 text-sm font-black text-[#071014] disabled:opacity-50">{busy ? "SUBMITTING…" : authenticated ? "APPLY FOR BETA" : "SIGN IN TO APPLY"}</button></form>}
    {message && <p role="status" className="mt-4 text-sm text-amber-200">{message}</p>}
  </section>;
}

function EnrollmentStatus({ enrollment }: { enrollment: Enrollment }) {
  const descriptions: Record<Enrollment["status"], string> = {
    applied: "Your application is queued for manual review. Competitive pilot games remain locked until activation.",
    active: "Access granted. You can now practice the five games and enter controlled testnet challenges.",
    completed: "Your current cohort participation is complete. Practice games remain available without stakes or prizes.",
    withdrawn: "This application is withdrawn. Contact the pilot operator if you want to join a future cohort.",
    rejected: "This application was not selected for the current cohort. Practice games remain publicly available.",
  };
  return <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Application status</p><p className="mt-1 font-display text-2xl font-bold uppercase text-cyan-200">{enrollment.status}</p><p className="mt-2 text-sm leading-6 text-slate-400">{descriptions[enrollment.status]}</p><p className="mt-2 text-xs text-slate-600">Submitted {new Date(enrollment.created_at).toLocaleDateString()}.</p><div className="mt-4 flex flex-wrap gap-3">{enrollment.status === "active" && <Link href="/challenges" className="rounded-lg bg-cyan-300 px-4 py-2 text-xs font-black text-[#071014]">ENTER CHALLENGE ARENA</Link>}<Link href="/pilot/games" className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-slate-300">PRACTICE FIVE GAMES</Link></div></div>;
}

function Consent({ name, children }: { name: string; children: React.ReactNode }) {
  return <label className="flex gap-3 rounded-lg border border-white/7 bg-black/15 p-3 text-sm leading-5 text-slate-400"><input required type="checkbox" name={name} className="mt-1 accent-cyan-300"/><span>{children}</span></label>;
}
