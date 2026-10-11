"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSkillFiUser } from "@/components/AuthSync";
import { formatUsdcUnits, parseUsdcUnits } from "@/lib/env/public";
import type { Guild, GuildProposal, GuildProposalType, GuildVoteChoice } from "@/lib/types";

async function json(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export function GuildsClient() {
  const { authenticated, getAccessToken, login } = usePrivy();
  const { profile, loading: profileLoading } = useSkillFiUser();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [currentGuild, setCurrentGuild] = useState<Guild | null>(null);
  const [proposals, setProposals] = useState<GuildProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [proposalType, setProposalType] = useState<GuildProposalType>("strategy");

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = authenticated ? await getAccessToken() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [authenticated, getAccessToken]);

  const loadGuilds = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/guilds", { headers: await authHeaders(), cache: "no-store" });
    const data = await json(response);
    if (!response.ok) {
      setSetupRequired(Boolean(data.setupRequired));
      setMessage(String(data.error ?? "Guild network could not be loaded."));
    } else {
      setGuilds((data.guilds as Guild[]) ?? []);
      setCurrentGuild((data.currentGuild as Guild | null) ?? null);
      setSetupRequired(false);
    }
    setLoading(false);
  }, [authHeaders]);

  const loadProposals = useCallback(async (guildId: string) => {
    const response = await fetch(`/api/guilds/${guildId}/proposals`, { headers: await authHeaders(), cache: "no-store" });
    const data = await json(response);
    if (response.ok) setProposals((data.proposals as GuildProposal[]) ?? []);
  }, [authHeaders]);

  useEffect(() => { if (!profileLoading) void loadGuilds(); }, [profileLoading, loadGuilds]);
  useEffect(() => { if (currentGuild) void loadProposals(currentGuild.id); else setProposals([]); }, [currentGuild, loadProposals]);

  async function createGuild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    setBusy("create"); setMessage("");
    const response = await fetch("/api/guilds", {
      method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ name: form.get("name"), description: form.get("description"), emblem: form.get("emblem") }),
    });
    const data = await json(response);
    setBusy(null); setMessage(response.ok ? "Guild DAO deployed to the battle network." : String(data.error ?? "Guild creation failed."));
    if (response.ok) { setShowCreate(false); await loadGuilds(); }
  }

  async function joinGuild(guildId: string) {
    if (!profile) return;
    setBusy(guildId); setMessage("");
    const response = await fetch(`/api/guilds/${guildId}/join`, { method: "POST", headers: await authHeaders() });
    const data = await json(response);
    setBusy(null); setMessage(response.ok ? "You joined the guild. Welcome to the war table." : String(data.error ?? "Could not join guild."));
    if (response.ok) await loadGuilds();
  }

  async function createProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentGuild) return;
    const form = new FormData(event.currentTarget);
    let amount: string | undefined;
    try { amount = proposalType === "treasury" ? parseUsdcUnits(String(form.get("amount") ?? "")).toString() : undefined; }
    catch (error) { setMessage(error instanceof Error ? error.message : "Invalid USDC amount."); return; }
    setBusy("proposal"); setMessage("");
    const response = await fetch(`/api/guilds/${currentGuild.id}/proposals`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: form.get("title"), description: form.get("description"), proposalType, amount }),
    });
    const data = await json(response);
    setBusy(null); setMessage(response.ok ? "Proposal opened for a 72-hour guild vote." : String(data.error ?? "Could not create proposal."));
    if (response.ok) { setShowProposal(false); await loadProposals(currentGuild.id); }
  }

  async function vote(proposalId: string, choice: GuildVoteChoice) {
    if (!currentGuild) return;
    setBusy(proposalId); setMessage("");
    const response = await fetch(`/api/guilds/${currentGuild.id}/votes`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ proposalId, choice }),
    });
    const data = await json(response);
    setBusy(null); setMessage(response.ok ? "Vote recorded. You can change it until voting closes." : String(data.error ?? "Vote failed."));
    if (response.ok) await loadProposals(currentGuild.id);
  }

  function primaryAction() {
    if (!authenticated) { login(); return; }
    if (!profile) { setMessage("Complete your player profile before creating or joining a guild."); return; }
    setShowCreate(true);
  }

  return <main className="mx-auto mx-auto max-w-[1440px] px-3 py-4 sm:px-5 sm:py-6 xl:px-7">
    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div><p className="launcher-kicker">Player-owned factions</p><h1 className="launcher-title mt-3 font-display text-4xl font-black sm:text-5xl">Guild Wars</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#777d88]">Join a faction, govern its treasury and turn verified wins into seasonal influence.</p></div>
      {currentGuild ? <button onClick={() => setShowProposal(true)} className="launcher-button-primary rounded-xl px-5 py-3 text-sm font-extrabold">OPEN PROPOSAL</button> : <button onClick={primaryAction} className="launcher-button-primary rounded-xl px-5 py-3 text-sm font-extrabold">CREATE A GUILD DAO</button>}
    </div>
    {message && <div role="status" className={`mt-5 rounded-xl border px-4 py-3 text-sm ${setupRequired ? "border-amber-300/20 bg-amber-300/10 text-[#9a681b]" : "border-cyan-300/15 bg-[#5146e5]/[.06] text-cyan-100"}`}>{message}</div>}
    {showCreate && <GuildForm busy={busy === "create"} onCancel={() => setShowCreate(false)} onSubmit={createGuild} />}

    {currentGuild && <section className="mt-6 overflow-hidden rounded-3xl border border-indigo-300/15 bg-[radial-gradient(circle_at_80%_10%,rgba(99,102,241,.2),transparent_30rem),#0c0e16] p-6 sm:p-9"><div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-5"><span className="grid h-20 w-20 place-items-center rounded-2xl border border-indigo-300/20 bg-[#eeedff] text-4xl">{currentGuild.emblem}</span><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#5146e5]">Your guild · {currentGuild.current_user_role}</p><h2 className="mt-2 font-display text-4xl font-black text-[#252833]">{currentGuild.name}</h2><p className="mt-2 max-w-xl text-sm text-[#777d88]">{currentGuild.description || "No doctrine published yet."}</p></div></div><div className="grid grid-cols-3 gap-3"><Stat value={String(currentGuild.member_count ?? 0)} label="MEMBERS"/><Stat value={String(currentGuild.season_influence)} label="INFLUENCE"/><Stat value={`${formatUsdcUnits(currentGuild.treasury_balance)} USDC`} label="TREASURY"/></div></div></section>}
    {showProposal && currentGuild && <ProposalForm type={proposalType} busy={busy === "proposal"} onType={setProposalType} onCancel={() => setShowProposal(false)} onSubmit={createProposal} />}
    {currentGuild && <section className="mt-5 rounded-3xl launcher-panel mt-5 p-6"><div className="flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Governance channel</h2><span className="text-xs text-[#777d88]">One member · one vote</span></div><div className="mt-5 grid gap-4 xl:grid-cols-2">{proposals.length ? proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} busy={busy === proposal.id} onVote={vote}/>) : <Empty text="No proposals yet. Open the first vote and set your guild’s direction."/>}</div></section>}

    {!currentGuild && <section className="mt-6 rounded-3xl launcher-panel mt-5 p-6"><div className="flex items-center justify-between"><h2 className="font-display text-2xl font-bold">War table</h2><span className="text-xs text-[#777d88]">{loading ? "Syncing network…" : `${guilds.length} factions`}</span></div><div className="mt-5 space-y-3">{!loading && !guilds.length && !setupRequired && <Empty text="No guilds have deployed yet. Found the first faction."/>}{guilds.map((guild) => <div key={guild.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-[#e7e7e1] bg-[#fafaf8] p-4 sm:grid-cols-[auto_1fr_120px_120px_auto]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eeedff] text-xl text-[#5146e5]">{guild.emblem}</span><div><p className="font-bold text-[#252833]">{guild.name}</p><p className="text-xs text-[#777d88]">{guild.member_count ?? 0} members · {guild.join_policy} recruitment</p></div><p className="hidden text-sm font-bold sm:block">{guild.season_influence} influence</p><p className="hidden text-sm text-[#737b87] sm:block">{formatUsdcUnits(guild.treasury_balance)} USDC</p><button disabled={!profile || busy === guild.id || guild.join_policy !== "open"} onClick={() => void joinGuild(guild.id)} className="rounded-lg border border-indigo-300/20 px-3 py-2 text-xs font-bold text-[#5146e5] disabled:opacity-40">{busy === guild.id ? "JOINING…" : "JOIN"}</button></div>)}</div></section>}
    <div className="mt-6 text-center"><Link href="/challenges" className="text-sm font-bold text-[#5146e5]">EARN INFLUENCE IN THE CHALLENGE ARENA →</Link></div>
  </main>;
}

function GuildForm({ busy, onCancel, onSubmit }: { busy: boolean; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit} className="mt-6 grid gap-4 rounded-3xl launcher-panel mt-6 p-6 md:grid-cols-[100px_1fr]"><label className="text-xs font-bold text-[#737b87]">EMBLEM<input name="emblem" defaultValue="⬢" maxLength={4} className="mt-2 w-full rounded-xl border border-[#e1e1dc] bg-white px-3 py-3 text-center text-2xl"/></label><div className="grid gap-4"><label className="text-xs font-bold text-[#737b87]">GUILD NAME<input required name="name" minLength={3} maxLength={48} placeholder="Arc Vanguard" className="mt-2 w-full rounded-xl border border-[#e1e1dc] bg-white px-4 py-3"/></label><label className="text-xs font-bold text-[#737b87]">BATTLE DOCTRINE<textarea name="description" maxLength={280} placeholder="What does your guild fight for?" className="mt-2 min-h-24 w-full rounded-xl border border-[#e1e1dc] bg-white px-4 py-3"/></label><div className="flex gap-3"><button disabled={busy} className="launcher-button-primary rounded-xl px-5 py-3 text-sm font-extrabold disabled:opacity-50">{busy ? "DEPLOYING…" : "DEPLOY GUILD"}</button><button type="button" onClick={onCancel} className="rounded-xl border border-[#e7e7e1] px-5 py-3 text-sm font-bold">CANCEL</button></div></div></form>;
}

function ProposalForm({ type, busy, onType, onCancel, onSubmit }: { type: GuildProposalType; busy: boolean; onType: (type: GuildProposalType) => void; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit} className="mt-5 rounded-3xl launcher-panel mt-5 p-6"><div className="grid gap-4 md:grid-cols-2"><label className="text-xs font-bold text-[#737b87]">PROPOSAL TYPE<select value={type} onChange={(event) => onType(event.target.value as GuildProposalType)} className="mt-2 w-full rounded-xl border border-[#e1e1dc] bg-white px-4 py-3"><option value="strategy">Strategy</option><option value="treasury">Treasury</option><option value="membership">Membership</option></select></label>{type === "treasury" && <label className="text-xs font-bold text-[#737b87]">REQUESTED USDC<input required name="amount" inputMode="decimal" placeholder="180" className="mt-2 w-full rounded-xl border border-[#e1e1dc] bg-white px-4 py-3"/></label>}<label className="text-xs font-bold text-[#737b87] md:col-span-2">TITLE<input required name="title" minLength={5} maxLength={100} className="mt-2 w-full rounded-xl border border-[#e1e1dc] bg-white px-4 py-3"/></label><label className="text-xs font-bold text-[#737b87] md:col-span-2">BRIEF<textarea required name="description" minLength={10} maxLength={1000} className="mt-2 min-h-28 w-full rounded-xl border border-[#e1e1dc] bg-white px-4 py-3"/></label></div><div className="mt-4 flex gap-3"><button disabled={busy} className="launcher-button-primary rounded-xl px-5 py-3 text-sm font-extrabold">{busy ? "OPENING…" : "START 72H VOTE"}</button><button type="button" onClick={onCancel} className="rounded-xl border border-[#e7e7e1] px-5 py-3 text-sm font-bold">CANCEL</button></div><p className="mt-3 text-xs text-[#777d88]">Treasury proposals record governance intent only; they cannot transfer funds yet.</p></form>;
}

function Stat({ value, label }: { value: string; label: string }) { return <div className="min-w-24 rounded-xl border border-[#e7e7e1] bg-[#f6f6f3] p-4"><p className="font-display text-xl font-bold">{value}</p><p className="mt-1 text-[9px] tracking-[.15em] text-[#777d88]">{label}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[#e7e7e1] p-8 text-center text-sm text-[#777d88] xl:col-span-2">{text}</div>; }

function ProposalCard({ proposal, busy, onVote }: { proposal: GuildProposal; busy: boolean; onVote: (id: string, choice: GuildVoteChoice) => void }) {
  const total = (proposal.votes_for ?? 0) + (proposal.votes_against ?? 0) + (proposal.votes_abstain ?? 0);
  const forPercent = total ? Math.round(((proposal.votes_for ?? 0) / total) * 100) : 0;
  const open = proposal.status === "active" && new Date(proposal.closes_at).getTime() > Date.now();
  return <article className="rounded-2xl border border-[#e7e7e1] bg-[#fafaf8] p-5"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-[#eeedff] px-3 py-1 text-[10px] font-bold uppercase text-[#5146e5]">{proposal.proposal_type}</span><span className="text-[10px] font-bold uppercase text-[#777d88]">{open ? `closes ${new Date(proposal.closes_at).toLocaleDateString()}` : proposal.status}</span></div><h3 className="mt-4 font-display text-xl font-bold">{proposal.title}</h3><p className="mt-2 text-sm leading-6 text-[#777d88]">{proposal.description}</p>{proposal.amount && <p className="mt-3 text-sm font-bold text-[#9a681b]">Treasury request · {formatUsdcUnits(proposal.amount)} USDC</p>}<div className="mt-5 h-2 overflow-hidden rounded-full bg-[#f9e8eb]"><div className="h-full bg-[#62a879]" style={{ width: `${forPercent}%` }}/></div><div className="mt-2 flex justify-between text-[10px] font-bold"><span className="text-[#37804b]">{proposal.votes_for ?? 0} FOR · {forPercent}%</span><span className="text-[#b94b5d]">{proposal.votes_against ?? 0} AGAINST</span></div>{open && <div className="mt-5 grid grid-cols-3 gap-2">{(["for", "against", "abstain"] as GuildVoteChoice[]).map((choice) => <button key={choice} disabled={busy} onClick={() => onVote(proposal.id, choice)} className={`rounded-lg border px-2 py-2 text-[10px] font-black uppercase ${proposal.current_user_vote === choice ? "border-cyan-300 bg-[#eeedff] text-[#4338ca]" : "border-[#e7e7e1] text-[#737b87]"}`}>{choice}</button>)}</div>}</article>;
}
