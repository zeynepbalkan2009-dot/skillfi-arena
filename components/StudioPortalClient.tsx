"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { erc20Abi } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { WalletConnect } from "@/components/WalletConnect";
import { USDC_TOKEN_ADDRESS } from "@/lib/contracts";
import type { Game, Studio } from "@/lib/types";

type PortalData = { studio: Studio | null; games: Game[]; isAdmin: boolean; fee: { amount: string; displayAmount: string; treasury: `0x${string}` } };
type Credential = { id: string; game_id: string; name: string; key_prefix: string; scopes: string[]; last_used_at: string | null; revoked_at: string | null; created_at: string };

export function StudioPortalClient() {
  const { authenticated, getAccessToken } = usePrivy();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [data, setData] = useState<PortalData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [studioDraft, setStudioDraft] = useState({ name: "", websiteUrl: "", contactEmail: "" });
  const [gameDraft, setGameDraft] = useState({ name: "", type: "web2", description: "", websiteUrl: "" });
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const response = await fetch("/api/studios", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Could not load studio portal");
    setData(body);
    if (body.studio) {
      const credentialResponse = await fetch("/api/studios/credentials", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const credentialBody = await credentialResponse.json().catch(() => ({}));
      if (!credentialResponse.ok) throw new Error(credentialBody.error ?? "Could not load integration credentials");
      setCredentials(credentialBody.credentials ?? []);
    } else setCredentials([]);
  }, [getAccessToken]);

  useEffect(() => { if (authenticated) void load().catch((error) => setMessage(error.message)); }, [authenticated, load]);

  async function createStudio(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/studios", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(studioDraft) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not create studio");
      await load(); setMessage("Studio account created. Add your first game and complete the testnet listing fee.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create studio"); }
    finally { setBusy(false); }
  }

  async function createGame(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/studios/games", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(gameDraft) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not create game draft");
      setGameDraft({ name: "", type: "web2", description: "", websiteUrl: "" }); await load(); setMessage("Game draft saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create game draft"); }
    finally { setBusy(false); }
  }

  async function payFee() {
    if (!data?.studio || !address || !publicClient) return;
    setBusy(true); setMessage(null);
    try {
      const hash = await writeContractAsync({ address: USDC_TOKEN_ADDRESS, abi: erc20Abi, functionName: "transfer", args: [data.fee.treasury, BigInt(data.fee.amount)] });
      await publicClient.waitForTransactionReceipt({ hash });
      const token = await getAccessToken();
      const response = await fetch("/api/studios/fee", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ studioId: data.studio.id, txHash: hash }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not verify listing fee");
      await load(); setMessage("Listing fee confirmed. Your studio is now awaiting review.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Listing fee failed"); }
    finally { setBusy(false); }
  }

  async function submitGame(gameId: string) {
    setBusy(true); setMessage(null);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/studios/games", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ gameId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not submit game");
      await load(); setMessage("Game submitted for technical review.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit game"); }
    finally { setBusy(false); }
  }

  async function createCredential(game: Game) {
    setBusy(true); setMessage(null); setNewSecret(null);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/studios/credentials", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ gameId: game.id, name: `${game.name} server key` }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not create integration key");
      setNewSecret(body.secret); await load(); setMessage("Integration key created. Copy it now; it cannot be shown again.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create integration key"); }
    finally { setBusy(false); }
  }

  async function revokeCredential(credentialId: string) {
    setBusy(true); setMessage(null);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/studios/credentials", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ credentialId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not revoke integration key");
      setRevokingId(null); await load(); setMessage("Integration key revoked.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not revoke integration key"); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-arena-bg px-5 py-8 text-arena-text">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between"><div className="flex gap-4"><Link href="/" className="text-sm text-arena-muted hover:text-white">Back to arena</Link>{data?.isAdmin && <Link href="/studio/review" className="text-sm text-arena-accent hover:text-white">Review queue</Link>}</div><WalletConnect /></div>
        <h1 className="mt-8 font-display text-4xl font-bold">Studio Portal</h1>
        <p className="mt-2 text-arena-muted">Submit a game, complete the testnet listing fee, and enter integration review.</p>
        {!authenticated ? <div className="mt-8 rounded-xl border border-arena-border bg-arena-surface p-6">Connect and log in to create a studio.</div> : !data ? <p className="mt-8 text-arena-muted">Loading…</p> : !data.studio ? (
          <form onSubmit={createStudio} className="mt-8 space-y-4 rounded-xl border border-arena-border bg-arena-surface p-6">
            <h2 className="font-display text-xl font-bold">Create studio account</h2>
            <input required minLength={2} maxLength={80} placeholder="Studio name" value={studioDraft.name} onChange={(e) => setStudioDraft({ ...studioDraft, name: e.target.value })} className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2" />
            <input type="url" placeholder="Website (optional)" value={studioDraft.websiteUrl} onChange={(e) => setStudioDraft({ ...studioDraft, websiteUrl: e.target.value })} className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2" />
            <input type="email" placeholder="Contact email" value={studioDraft.contactEmail} onChange={(e) => setStudioDraft({ ...studioDraft, contactEmail: e.target.value })} className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2" />
            <button disabled={busy} className="rounded-md bg-arena-accent px-4 py-2 font-semibold text-arena-bg disabled:opacity-50">Create studio</button>
          </form>
        ) : (
          <div className="mt-8 grid gap-6">
            <section className="rounded-xl border border-arena-border bg-arena-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl font-bold">{data.studio.name}</h2><p className="mt-1 text-sm capitalize text-arena-muted">Status: {data.studio.status.replaceAll("_", " ")}</p></div>{data.studio.status === "pending_payment" && <button type="button" onClick={payFee} disabled={busy || !address} className="rounded-md bg-arena-accent px-4 py-2 font-semibold text-arena-bg disabled:opacity-50">Pay {data.fee.displayAmount} USDC</button>}</div>
              <p className="mt-4 text-xs text-arena-muted">Testnet listing payment is separate from player stakes and match escrow.</p>
            </section>
            <form onSubmit={createGame} className="space-y-4 rounded-xl border border-arena-border bg-arena-surface p-6">
              <h2 className="font-display text-xl font-bold">Add a game draft</h2>
              <input required minLength={2} maxLength={100} placeholder="Game name" value={gameDraft.name} onChange={(e) => setGameDraft({ ...gameDraft, name: e.target.value })} className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2" />
              <select value={gameDraft.type} onChange={(e) => setGameDraft({ ...gameDraft, type: e.target.value })} className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2"><option value="web2">Web2</option><option value="web3">Web3</option></select>
              <textarea required maxLength={1000} placeholder="Describe the game and how match results can be verified." value={gameDraft.description} onChange={(e) => setGameDraft({ ...gameDraft, description: e.target.value })} className="min-h-28 w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2" />
              <input type="url" placeholder="Game website (optional)" value={gameDraft.websiteUrl} onChange={(e) => setGameDraft({ ...gameDraft, websiteUrl: e.target.value })} className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2" />
              <button disabled={busy} className="rounded-md bg-arena-accent px-4 py-2 font-semibold text-arena-bg disabled:opacity-50">Save game draft</button>
            </form>
            {data.games.length > 0 && <section className="rounded-xl border border-arena-border bg-arena-surface p-6"><h2 className="font-display text-xl font-bold">Your games</h2><div className="mt-4 space-y-3">{data.games.map((game) => <div key={game.id} className="rounded-md border border-arena-border bg-arena-bg p-4"><div className="flex justify-between gap-3"><span className="font-semibold">{game.name}</span><span className="text-sm capitalize text-arena-muted">{game.integration_status}</span></div><p className="mt-2 text-sm text-arena-muted">{game.description}</p>{game.integration_status === "draft" && <button type="button" onClick={() => submitGame(game.id)} disabled={busy || data.studio?.status === "pending_payment"} className="mt-3 rounded-md border border-arena-accent-dim px-3 py-2 text-xs font-semibold text-arena-accent disabled:opacity-40">Submit for review</button>}{['sandbox', 'published'].includes(game.integration_status ?? "") && <button type="button" onClick={() => createCredential(game)} disabled={busy} className="mt-3 rounded-md border border-arena-accent-dim px-3 py-2 text-xs font-semibold text-arena-accent disabled:opacity-40">Create integration key</button>}</div>)}</div></section>}
            {newSecret && <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6"><h2 className="font-display text-xl font-bold text-amber-100">Copy your new key now</h2><p className="mt-2 text-sm text-amber-100/70">For security, SkillFi cannot display it again.</p><code className="mt-4 block break-all rounded-md bg-black/30 p-4 text-sm text-amber-100">{newSecret}</code><button type="button" onClick={() => navigator.clipboard.writeText(newSecret)} className="mt-3 rounded-md border border-amber-400/40 px-3 py-2 text-xs text-amber-100">Copy key</button></section>}
            {credentials.length > 0 && <section className="rounded-xl border border-arena-border bg-arena-surface p-6"><h2 className="font-display text-xl font-bold">Integration keys</h2><div className="mt-4 space-y-3">{credentials.map((credential) => <div key={credential.id} className="rounded-md border border-arena-border bg-arena-bg p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{credential.name}</p><code className="mt-1 block text-xs text-arena-muted">{credential.key_prefix}••••••••</code><p className="mt-1 text-xs text-arena-muted">{credential.scopes.join(", ")}{credential.last_used_at ? ` · Last used ${new Date(credential.last_used_at).toLocaleString()}` : " · Never used"}</p></div>{credential.revoked_at ? <span className="text-xs text-arena-danger">Revoked</span> : revokingId === credential.id ? <div className="flex gap-2"><button type="button" onClick={() => setRevokingId(null)} className="rounded-md border border-arena-border px-3 py-2 text-xs">Keep</button><button type="button" disabled={busy} onClick={() => revokeCredential(credential.id)} className="rounded-md bg-arena-danger px-3 py-2 text-xs font-semibold text-white">Confirm revoke</button></div> : <button type="button" onClick={() => setRevokingId(credential.id)} className="rounded-md border border-arena-danger/40 px-3 py-2 text-xs text-arena-danger">Revoke</button>}</div></div>)}</div></section>}
          </div>
        )}
        {message && <p className="mt-5 rounded-md border border-arena-border bg-arena-surface p-4 text-sm text-arena-muted">{message}</p>}
      </div>
    </main>
  );
}
