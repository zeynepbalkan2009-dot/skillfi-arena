"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSkillFiUser } from "@/components/AuthSync";
import { OnboardingCard } from "@/components/OnboardingCard";
import { WalletConnect } from "@/components/WalletConnect";
import type { PlayerProfile } from "@/lib/types";

export function ProfileClient() {
  const { authenticated, getAccessToken } = usePrivy();
  const { profile, needsProfile } = useSkillFiUser();
  const [draft, setDraft] = useState({ username: "", displayName: "", avatarUrl: "" });
  const [savedProfile, setSavedProfile] = useState<PlayerProfile | null>(profile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setSavedProfile(profile);
    setDraft({
      username: profile.username,
      displayName: profile.display_name ?? "",
      avatarUrl: profile.avatar_url ?? "",
    });
  }, [profile]);

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
        </section>
      )}
    </main>
  );
}
