"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { PlayerProfile, UserRegion } from "@/lib/types";

interface SkillFiUserContextValue {
  /** null while loading, or if the wallet has no linked SkillFi account yet. */
  profile: PlayerProfile | null;
  loading: boolean;
  /** True once we've confirmed Privy has no authenticated user at all
   *  (as opposed to "still figuring that out"). */
  needsProfile: boolean;
  /** Call after collecting username/region from a logged-in-but-unregistered
   *  user, to complete account creation. */
  completeProfile: (username: string, region: UserRegion) => Promise<void>;
}

const SkillFiUserContext = createContext<SkillFiUserContextValue | null>(null);

/** Read the resolved SkillFi profile for whoever Privy currently has
 *  logged in. Must be used under <Providers> (see app/providers.tsx). */
export function useSkillFiUser(): SkillFiUserContextValue {
  const ctx = useContext(SkillFiUserContext);
  if (!ctx) throw new Error("useSkillFiUser must be used within Providers");
  return ctx;
}

async function callSync(getAccessToken: () => Promise<string | null>, body?: object) {
  const token = await getAccessToken();
  if (!token) throw new Error("No Privy access token available");

  const response = await fetch("/api/auth/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });

  const json = await response.json();
  if (!response.ok) {
    const err = new Error(json.error ?? "Account sync failed") as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  return json.user as PlayerProfile;
}

export function AuthSync({ children }: { children: ReactNode }) {
  const { ready, authenticated, getAccessToken, user: privyUser } = usePrivy();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);

  // Privy can report `authenticated: true` more than once across a
  // session (token refreshes, tab refocus). Track the last state we
  // actually synced for, so we don't re-POST on every re-render.
  const lastSyncedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated) {
      setProfile(null);
      setLoading(false);
      setNeedsProfile(false);
      lastSyncedUserId.current = null;
      return;
    }

    if (!privyUser?.id || lastSyncedUserId.current === privyUser.id) return;
    lastSyncedUserId.current = privyUser.id;

    setProfile(null);
    setNeedsProfile(false);
    setLoading(true);
    callSync(getAccessToken)
      .then((user) => {
        setProfile(user);
        setNeedsProfile(false);
      })
      .catch((err) => {
        // 400 here specifically means "this Privy user has no SkillFi
        // account yet and we don't have a username/region to create one
        // with" — see app/api/auth/sync/route.ts. That's an expected
        // state for a first-time login, not a failure.
        if (err?.status === 400) {
          setProfile(null);
          setNeedsProfile(true);
        } else {
          console.error("Account sync failed:", err);
        }
      })
      .finally(() => setLoading(false));
  }, [ready, authenticated, getAccessToken, privyUser?.id]);

  async function completeProfile(username: string, region: UserRegion) {
    const user = await callSync(getAccessToken, { username, region });
    setProfile(user);
    setNeedsProfile(false);
  }

  return (
    <SkillFiUserContext.Provider value={{ profile, loading, needsProfile, completeProfile }}>
      {children}
    </SkillFiUserContext.Provider>
  );
}
