import { NextRequest, NextResponse } from "next/server";
import { getPrivyIdentityFromRequest, MissingProfileFieldsError, syncProfile } from "@/lib/auth/server";
import { consumeRateLimit } from "@/lib/rateLimit";
import type { UserRegion } from "@/lib/types";

interface SyncRequestBody {
  username?: string;
  region?: UserRegion;
  displayName?: string;
  avatarUrl?: string;
}

export async function POST(request: NextRequest) {
  const identity = await getPrivyIdentityFromRequest(request.headers.get("authorization"));
  if (!identity) {
    return NextResponse.json({ error: "Invalid or missing Privy access token" }, { status: 401 });
  }

  const rate = await consumeRateLimit("auth-sync", identity.privyUserId, 20, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many account sync requests" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: SyncRequestBody = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const user = await syncProfile(identity, body);
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    if (error instanceof MissingProfileFieldsError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Account sync failed";
    if (/duplicate|unique/i.test(message)) {
      return NextResponse.json({ error: "Profile already exists" }, { status: 409 });
    }
    if (/username|region/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    console.error("Account sync failed:", message);
    return NextResponse.json({ error: "Account sync failed" }, { status: 500 });
  }
}
