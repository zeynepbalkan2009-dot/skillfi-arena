"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSkillFiUser } from "@/components/AuthSync";
import { OnboardingCard } from "@/components/OnboardingCard";
import { WalletConnect } from "@/components/WalletConnect";
import { formatUsdcUnits } from "@/lib/env/public";
import type { MatchAuditEvent, MatchWithRelations, PlayerProfile } from "@/lib/types";

export function ProfileClient() {
  const { authenticated, getAccessToken } = usePrivy();
  const { profile, needsProfile } = useSkillFiUser();
  const [draft, setDraft] = useState({ username: "", displayName: "", avatarUrl: "" });
  const [savedProfile, setSavedProfile] = useState<PlayerProfile | null>(profile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchWithRelations[]>([]);
  const [auditEvents, setAuditEvents] = useState<MatchAuditEvent[]>([]);
  const disputedMatches = matches.filter((match) => match.status === "disputed");

  useEffect(() => {
    if (!profile) return;
    setSavedProfile(profile);
    setDraft({
      username: profile.username,
      displayName: profile.display_name ?? "",
      avatarUrl: profile.avatar_url ?? "",
    });
  }, [profile]);

  useEffect(() => {
    if (!profile?.id) {
      setMatches([]);
      setAuditEvents([]);
      return;
    }

    let active = true;
    async function loadMatches() {
      const token = await getAccessToken();
      if (!token) return;
      const response = await fetch("/api/profile/matches", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (active && response.ok) {
        setMatches(body.matches ?? []);
        setAuditEvents(body.events ?? []);
      }
    }

    void loadMatches();
    return () => {
      active = false;
    };
  }, [getAccessToken, profile?.id]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No Privy access token available.");
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Profile update failed.");
      setSavedProfile(body.user);
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profile update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm font-medium text-arena-muted hover:text-arena-text">
          Back to lobby
        </Link>
        <WalletConnect />
      </div>

      {!authenticated ? (
        <section className="rounded-lg border border-arena-border bg-arena-surface p-6">
          <h1 className="font-display text-2xl font-bold text-arena-text">Player Profile</h1>
          <p className="mt-2 text-sm text-arena-muted">Connect or log in to manage your SkillFi profile.</p>
        </section>
      ) : needsProfile ? (
        <OnboardingCard />
      ) : (
        <section className="rounded-lg border border-arena-border bg-arena-surface p-6">
          <h1 className="font-display text-2xl font-bold text-arena-text">Player Profile</h1>
          <form onSubmit={saveProfile} className="mt-6 space-y-4">
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-arena-muted">
                Username
              </label>
              <input
                id="username"
                value={draft.username}
                onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
                className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text focus:border-arena-accent focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="display-name" className="mb-1 block text-sm font-medium text-arena-muted">
                Display name
              </label>
              <input
                id="display-name"
                value={draft.displayName}
                onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text focus:border-arena-accent focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="avatar-url" className="mb-1 block text-sm font-medium text-arena-muted">
                Avatar URL
              </label>
              <input
                id="avatar-url"
                value={draft.avatarUrl}
                onChange={(event) => setDraft((current) => ({ ...current, avatarUrl: event.target.value }))}
                className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text focus:border-arena-accent focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !draft.username}
              className="rounded-md bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg hover:bg-arena-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </form>

          {message && <p className="mt-4 text-sm text-arena-muted">{message}</p>}

          {savedProfile && (
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-md bg-arena-bg p-3">
                <dt className="text-arena-muted">Wallet</dt>
                <dd className="mt-1 break-all text-arena-text">
                  {savedProfile.primary_wallet_address ?? savedProfile.wallet_address ?? "No wallet linked"}
                </dd>
              </div>
              <div className="rounded-md bg-arena-bg p-3">
                <dt className="text-arena-muted">Record</dt>
                <dd className="mt-1 text-arena-text">
                  {savedProfile.wins ?? 0}-{savedProfile.losses ?? 0} / ELO {savedProfile.elo_rating ?? 1000}
                </dd>
              </div>
            </dl>
          )}

          {savedProfile && (
            <div className="mt-8 border-t border-arena-border pt-6">
              <h2 className="font-display text-xl font-bold text-arena-text">Match History</h2>
              {disputedMatches.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <p className="font-semibold">
                    {disputedMatches.length} {disputedMatches.length === 1 ? "match is" : "matches are"} under review
                  </p>
                  <p className="mt-1 text-amber-100/80">
                    Automatic payout is paused while an authorized arbiter reviews the result. No additional wallet action is required.
                  </p>
                </div>
              )}
              {matches.length === 0 ? (
                <p className="mt-3 text-sm text-arena-muted">No matches yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {matches.map((match) => {
                    const opponent =
                      match.player_a_id === savedProfile.id ? match.player_b : match.player_a;
                    const outcome =
                      match.status !== "completed"
                        ? match.status
                        : match.winner_id === savedProfile.id
                          ? "won"
                          : "lost";
                    return (
                      <Link
                        key={match.id}
                        href={`/matches/${match.id}`}
                        className="flex items-center justify-between gap-4 rounded-lg border border-arena-border bg-arena-bg p-4 hover:border-arena-accent-dim"
                      >
                        <div>
                          <p className="font-display font-semibold text-arena-text">
                            {match.game?.name ?? "SkillFi Match"}
                          </p>
                          <p className="mt-1 text-sm text-arena-muted">
                            vs {opponent?.display_name ?? opponent?.username ?? "Waiting for opponent"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold capitalize ${
                            outcome === "disputed" ? "text-amber-300" : "text-arena-accent"
                          }`}>
                            {outcome === "disputed" ? "under review" : outcome.replaceAll("_", " ")}
                          </p>
                          <p className="mt-1 text-xs text-arena-muted">
                            {formatUsdcUnits(match.stake_amount)} USDC
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {savedProfile && auditEvents.length > 0 && (
            <div className="mt-8 border-t border-arena-border pt-6">
              <h2 className="font-display text-xl font-bold text-arena-text">Transaction & Audit Trail</h2>
              <div className="mt-4 space-y-2">
                {auditEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-arena-border bg-arena-bg p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium capitalize text-arena-text">
                        {event.event_type.replaceAll("_", " ")}
                      </span>
                      <time className="text-xs text-arena-muted">{new Date(event.created_at).toLocaleString()}</time>
                    </div>
                    {event.tx_hash && (
                      <a
                        href={`https://sepolia.basescan.org/tx/${event.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block truncate text-xs text-arena-accent hover:underline"
                      >
                        {event.tx_hash}
                      </a>
                    )}
                    {event.event_type === "match_disputed" && typeof event.payload?.reason === "string" && (
                      <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-100/80">
                        Reason: {event.payload.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
