"use client";

import { useState, type FormEvent } from "react";
import { useSkillFiUser } from "@/components/AuthSync";
import type { UserRegion } from "@/lib/types";

const REGIONS: UserRegion[] = ["EU", "NA", "ASIA"];

/**
 * Shown when AuthSync's useSkillFiUser() reports needsProfile: true —
 * i.e. Privy has an authenticated user, but app/api/auth/sync hasn't
 * seen this Privy ID before and needs a username/region to create the
 * public.users row (Privy itself doesn't collect either of these).
 */
export function OnboardingCard() {
  const { completeProfile } = useSkillFiUser();
  const [username, setUsername] = useState("");
  const [region, setRegion] = useState<UserRegion>("EU");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim()) {
      setError("Choose a username.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await completeProfile(username.trim(), region);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create your account. Try a different username.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-lg border border-arena-border bg-arena-surface p-6">
      <h2 className="font-display text-lg font-bold text-arena-text">One last step</h2>
      <p className="mt-1 text-sm text-arena-muted">Pick a username and region to finish setting up your account.</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="onboard-username" className="mb-1 block text-sm font-medium text-arena-muted">
            Username
          </label>
          <input
            id="onboard-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text focus:border-arena-accent focus:outline-none disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="onboard-region" className="mb-1 block text-sm font-medium text-arena-muted">
            Region
          </label>
          <select
            id="onboard-region"
            value={region}
            onChange={(e) => setRegion(e.target.value as UserRegion)}
            disabled={submitting}
            className="w-full rounded-md border border-arena-border bg-arena-bg px-3 py-2 text-arena-text focus:border-arena-accent focus:outline-none disabled:opacity-50"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-md border border-arena-danger/40 bg-arena-danger/10 px-3 py-2 text-sm text-arena-danger">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-arena-accent px-4 py-2 text-sm font-semibold text-arena-bg hover:bg-arena-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Enter the Arena"}
        </button>
      </form>
    </div>
  );
}
