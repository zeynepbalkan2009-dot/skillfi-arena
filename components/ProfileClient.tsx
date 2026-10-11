"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSkillFiUser } from "@/components/AuthSync";
import { OnboardingCard } from "@/components/OnboardingCard";
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
    <main className="mx-auto max-w-[1440px] px-3 py-4 sm:px-5 sm:py-6 xl:px-7">
      <header className="mb-7 border-b border-[#e5e5df] pb-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="launcher-kicker">
              Player station / 05
            </p>
            <h1 className="launcher-title mt-4 font-display text-4xl font-black sm:text-5xl">
              Your pilot profile.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#777d88]">
              Season 00 progression, match record and verified activity in one place.
            </p>
          </div>
          <Link href="/games" className="text-sm font-extrabold text-[#5146e5] hover:text-[#3930b3]">
            Back to game library →
          </Link>
        </div>
      </header>
      {!authenticated ? (
        <section className="launcher-panel p-6 sm:p-7">
          <div className="mb-6 flex items-center justify-between border-b border-[#e7e7e1] pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#777d88]">Season 00 / identity</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-[#252833]">Player profile</h2>
            </div>
            <span className="rounded-md border border-[#e7e7e1] bg-[#eeedff] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[.14em] text-[#5146e5]">
              Pilot active
            </span>
          </div>
          <p className="mt-2 text-sm text-[#777d88]">Connect or log in to manage your SkillFi profile.</p>
        </section>
      ) : needsProfile ? (
        <OnboardingCard />
      ) : (
        <section className="launcher-panel p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e7e1] pb-4"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#777d88]">Season 00 / identity</p><h2 className="mt-1 font-display text-2xl font-bold text-[#252833]">Player profile</h2></div><span className="rounded-md border border-[#e7e7e1] bg-[#eeedff] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[.14em] text-[#5146e5]">Pilot profile</span></div>
          <form onSubmit={saveProfile} className="mt-6 space-y-4">
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-[#777d88]">
                Username
              </label>
              <input
                id="username"
                value={draft.username}
                onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
                className="w-full rounded-lg border border-[#e1e1dc] bg-white px-3 py-2 text-[#252833] focus:border-[#5146e5] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="display-name" className="mb-1 block text-sm font-medium text-[#777d88]">
                Display name
              </label>
              <input
                id="display-name"
                value={draft.displayName}
                onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                className="w-full rounded-lg border border-[#e1e1dc] bg-white px-3 py-2 text-[#252833] focus:border-[#5146e5] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="avatar-url" className="mb-1 block text-sm font-medium text-[#777d88]">
                Avatar URL
              </label>
              <input
                id="avatar-url"
                value={draft.avatarUrl}
                onChange={(event) => setDraft((current) => ({ ...current, avatarUrl: event.target.value }))}
                className="w-full rounded-lg border border-[#e1e1dc] bg-white px-3 py-2 text-[#252833] focus:border-[#5146e5] focus:outline-none"
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

          {message && <p className="mt-4 text-sm text-[#777d88]">{message}</p>}

          {savedProfile && (
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-md bg-[#fafaf8] p-3">
                <dt className="text-[#777d88]">Wallet</dt>
                <dd className="mt-1 break-all text-[#252833]">
                  {savedProfile.primary_wallet_address ?? savedProfile.wallet_address ?? "No wallet linked"}
                </dd>
              </div>
              <div className="rounded-md bg-[#fafaf8] p-3">
                <dt className="text-[#777d88]">Record</dt>
                <dd className="mt-1 text-[#252833]">
                  {savedProfile.wins ?? 0}-{savedProfile.losses ?? 0} / ELO {savedProfile.elo_rating ?? 1000}
                </dd>
              </div>
            </dl>
          )}

          {savedProfile && (
            <div className="mt-8 border-t border-[#e7e7e1] pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#777d88]">Run log</p>
                  <h2 className="mt-1 font-display text-xl font-bold text-[#252833]">Match history</h2>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[.14em] text-[#777d88]">{matches.length.toString().padStart(2, "0")} rounds</span>
              </div>
              {disputedMatches.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900">
                  <p className="font-semibold">
                    {disputedMatches.length} {disputedMatches.length === 1 ? "match is" : "matches are"} under review
                  </p>
                  <p className="mt-1 text-amber-800">
                    Automatic payout is paused while an authorized arbiter reviews the result. No additional wallet action is required.
                  </p>
                </div>
              )}
              {matches.length === 0 ? (
                <p className="mt-3 text-sm text-[#777d88]">No matches yet.</p>
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
                        className="flex items-center justify-between gap-4 rounded-lg border border-[#e7e7e1] bg-[#fafaf8] p-4 hover:border-arena-accent-dim"
                      >
                        <div>
                          <p className="font-display font-semibold text-[#252833]">
                            {match.game?.name ?? "SkillFi Match"}
                          </p>
                          <p className="mt-1 text-sm text-[#777d88]">
                            vs {opponent?.display_name ?? opponent?.username ?? "Waiting for opponent"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold capitalize ${
                            outcome === "disputed" ? "text-amber-700" : "text-arena-accent"
                          }`}>
                            {outcome === "disputed" ? "under review" : outcome.replaceAll("_", " ")}
                          </p>
                          <p className="mt-1 text-xs text-[#777d88]">
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
            <div className="mt-8 border-t border-[#e7e7e1] pt-6">
              <h2 className="font-display text-xl font-bold text-[#252833]">Transaction & Audit Trail</h2>
              <div className="mt-4 space-y-2">
                {auditEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-[#e7e7e1] bg-[#fafaf8] p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium capitalize text-[#252833]">
                        {event.event_type.replaceAll("_", " ")}
                      </span>
                      <time className="text-xs text-[#777d88]">{new Date(event.created_at).toLocaleString()}</time>
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
