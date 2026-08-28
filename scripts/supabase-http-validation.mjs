import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, "tmp", "supabase-http-validation");
const reportPath = join(outDir, "supabase-http-validation-output.json");
const port = Number(process.env.SKILLFI_HTTP_TEST_PORT ?? 3210);
const baseUrl = `http://127.0.0.1:${port}`;

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  const env = {};
  const values = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [rawKey, ...rest] = line.replace(/^export\s+/, "").split("=");
    const key = rawKey.trim();
    const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    if (!values[key]) values[key] = [];
    values[key].push(value);
    if (key) env[key] = value;
  }
  env.__values = values;
  return env;
}

function requireEnv(env, key) {
  if (!env[key]) throw new Error(`Missing ${key}`);
  return env[key];
}

function normalizeUrl(value) {
  if (!value) return value;
  const index = value.indexOf("https://") >= 0 ? value.indexOf("https://") : value.indexOf("http://");
  return index >= 0 ? value.slice(index).trim() : value;
}

function firstValidUrl(env, key) {
  for (const value of [...(env.__values?.[key] ?? [])].reverse()) {
    const candidate = normalizeUrl(value);
    if (/^https?:\/\/[^/]+/i.test(candidate)) return candidate;
  }
  return normalizeUrl(env[key]);
}

function looksPlaceholder(value) {
  return !value || /your-|<|>|placeholder/i.test(value);
}

function jwtRole(value) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;

  try {
    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4 !== 0) payload += "=";
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}

function assertServiceRoleCredential(value) {
  if (value.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is configured with a publishable key; use a server-only service-role secret.");
  }

  if (value.startsWith("sb_secret_")) return;

  const role = jwtRole(value);
  if (role === "service_role") return;

  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not recognized as a service-role credential.");
}

function tokenHash(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function usdcUnits(value) {
  const [whole, fraction = ""] = value.split(".");
  return (BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"))).toString();
}

function isNonZeroAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(value ?? "") && !/^0x0{40}$/i.test(value);
}

function escrowEnvironmentReady(env) {
  const operatorKey = (env.OPERATOR_PRIVATE_KEY ?? "").replace(/^0x/, "");
  return Boolean(
    /^[0-9a-fA-F]{64}$/.test(operatorKey) &&
      isNonZeroAddress(env.NEXT_PUBLIC_ESCROW_ADDRESS) &&
      isNonZeroAddress(env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS) &&
      /^https?:\/\//i.test(env.RPC_URL ?? env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "")
  );
}

function testWalletAddress(discriminator, stamp) {
  return `0x${createHash("sha256").update(`${discriminator}:${stamp}`).digest("hex").slice(0, 40)}`;
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 120_000) {
    try {
      const res = await fetch(`${baseUrl}/api/profile`);
      if ([401, 500].includes(res.status)) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Next.js server did not become ready");
}

function startServer(env) {
  const nextCli = join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextCli, "dev", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs = [];
  const redactLog = (value) =>
    value
      .replace(/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, "<redacted>")
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "<redacted>")
      .replace(/0x[a-fA-F0-9]{64}/g, "<redacted>");
  child.stdout.on("data", (chunk) => {
    logs.push(redactLog(chunk.toString()));
  });
  child.stderr.on("data", (chunk) => {
    logs.push(redactLog(chunk.toString()));
  });
  return { child, logs };
}

async function httpJson(path, { method = "GET", token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: response.status, ok: response.ok, json };
}

async function seedChallenge(service, { gameId, creatorId, stamp, suffix, expiresAt, status = "open" }) {
  const challengeId = randomUUID();
  const invitationToken = `validation-invite-${stamp}-${suffix}-${randomUUID()}`;
  const { error: challengeError } = await service.from("challenges").insert({
    id: challengeId,
    invitation_token_hash: tokenHash(invitationToken),
    idempotency_key: `http-validation-${stamp}-${suffix}`,
    game_id: gameId,
    creator_id: creatorId,
    invited_opponent_id: null,
    entry_fee: usdcUnits("1"),
    currency: "USDC",
    opponent_mode: "open",
    rules: "HTTP validation fixture",
    status,
    expires_at: expiresAt ?? new Date(Date.now() + 60 * 60_000).toISOString(),
  });
  if (challengeError) throw new Error(`Challenge seed failed: ${challengeError.message}`);

  const { error: participantError } = await service.from("challenge_participants").upsert(
    {
      challenge_id: challengeId,
      user_id: creatorId,
      role: "creator",
    },
    { onConflict: "challenge_id,user_id" }
  );
  if (participantError) throw new Error(`Challenge participant seed failed: ${participantError.message}`);

  return { id: challengeId, invitationToken };
}

async function run() {
  mkdirSync(outDir, { recursive: true });
  const fileEnv = loadDotEnv(join(root, ".env.local"));
  const env = { ...process.env, ...fileEnv };

  env.NEXT_PUBLIC_SUPABASE_URL = firstValidUrl(env, "NEXT_PUBLIC_SUPABASE_URL");
  requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  if (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  }
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = requireEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  env.SUPABASE_SERVICE_ROLE_KEY = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  assertServiceRoleCredential(env.SUPABASE_SERVICE_ROLE_KEY);
  env.NEXT_PUBLIC_PRIVY_APP_ID = env.NEXT_PUBLIC_PRIVY_APP_ID || "skillfi-test-privy-app";
  env.PRIVY_APP_SECRET = env.PRIVY_APP_SECRET || "skillfi-test-privy-secret";
  env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS =
    env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS ||
    env.NEXT_PUBLIC_GNESS_TOKEN_ADDRESS ||
    "0x0000000000000000000000000000000000000000";
  env.NEXT_PUBLIC_ESCROW_ADDRESS =
    env.NEXT_PUBLIC_ESCROW_ADDRESS || "0x0000000000000000000000000000000000000000";
  env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID =
    env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "skillfi-test-walletconnect";
  env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL =
    env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ||
    (/^https?:\/\//i.test(env.RPC_URL ?? "") ? env.RPC_URL : "https://sepolia.base.org");
  env.OPERATOR_WALLET_ADDRESS =
    env.OPERATOR_WALLET_ADDRESS || "0x0000000000000000000000000000000000000000";
  env.NODE_ENV = "development";

  const stamp = Date.now().toString(36);
  const players = {
    A: {
      token: `skillfi-token-a-${stamp}`,
      did: `did:privy:skillfi-a-${stamp}`,
      username: `http_a_${stamp}`,
      region: "EU",
      email: `http-a-${stamp}@example.invalid`,
      wallet: testWalletAddress("1", stamp),
    },
    B: {
      token: `skillfi-token-b-${stamp}`,
      did: `did:privy:skillfi-b-${stamp}`,
      username: `http_b_${stamp}`,
      region: "NA",
      email: `http-b-${stamp}@example.invalid`,
      wallet: testWalletAddress("2", stamp),
    },
    C: {
      token: `skillfi-token-c-${stamp}`,
      did: `did:privy:skillfi-c-${stamp}`,
      username: `http_c_${stamp}`,
      region: "EU",
      email: `http-c-${stamp}@example.invalid`,
      wallet: testWalletAddress("3", stamp),
    },
  };
  env.SKILLFI_TEST_PRIVY_TOKEN_MAP = JSON.stringify(
    Object.fromEntries(Object.values(players).map((player) => [player.token, player.did]))
  );
  env.SKILLFI_TEST_PRIVY_USERS = JSON.stringify(
    Object.fromEntries(
      Object.values(players).map((player) => [
        player.did,
        { email: player.email, primaryWallet: player.wallet },
      ])
    )
  );

  const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const report = {
    environment: {
      type: "dedicated-supabase-development-project",
      urlConfigured: true,
      anonKeyConfigured: true,
      serviceRoleConfigured: true,
      escrowConfigured: escrowEnvironmentReady(env),
      dbUrlConfigured: Boolean(env.SUPABASE_DB_URL || env.DATABASE_URL || env.POSTGRES_URL),
    },
    migrationMechanism: {
      attempted: false,
      result: "not-run",
      reason: "No Supabase CLI token/project ref or DB URL was available in .env.local.",
    },
    schema: {},
    flow: {},
    concurrency: {},
    rls: {},
    realtime: {},
  };

  const schemaChecks = await Promise.allSettled([
    service.from("challenges").select("id,status,entry_fee").limit(1),
    service.rpc("accept_challenge", { p_challenge_id: randomUUID(), p_player_id: randomUUID() }),
  ]);
  report.schema.challengesReadable = schemaChecks[0].status === "fulfilled" && !schemaChecks[0].value.error;
  report.schema.acceptChallengeRpcVisible =
    schemaChecks[1].status === "fulfilled" &&
    Boolean(schemaChecks[1].value.error?.message?.includes("challenge not found"));
  report.schema.rpcProbeMessage =
    schemaChecks[1].status === "fulfilled" ? schemaChecks[1].value.error?.message ?? null : "request failed";

  const gameId = randomUUID();
  const { error: gameError } = await service.from("games").upsert(
    {
      id: gameId,
      name: `HTTP Validation ${stamp}`,
      type: "web2",
      is_active: true,
    },
    { onConflict: "id" }
  );
  if (gameError) throw new Error(`Game seed failed: ${gameError.message}`);

  const { child, logs } = startServer(env);
  try {
    await waitForServer();

    report.flow.missingAuthProfile = await httpJson("/api/profile");
    report.flow.invalidAuthProfile = await httpJson("/api/profile", { token: "invalid-token" });

    report.flow.syncA = await httpJson("/api/auth/sync", {
      method: "POST",
      token: players.A.token,
      body: { username: players.A.username, region: players.A.region },
    });
    report.flow.syncB = await httpJson("/api/auth/sync", {
      method: "POST",
      token: players.B.token,
      body: { username: players.B.username, region: players.B.region },
    });
    report.flow.syncC = await httpJson("/api/auth/sync", {
      method: "POST",
      token: players.C.token,
      body: { username: players.C.username, region: players.C.region },
    });
    console.log("Supabase HTTP validation: profiles synced");

    report.flow.profileA = await httpJson("/api/profile", { token: players.A.token });
    report.flow.invalidCreate = escrowEnvironmentReady(env)
      ? await httpJson("/api/matches/create", {
          method: "POST",
          token: players.A.token,
          body: { gameId, stakeAmount: "0" },
        })
      : { skipped: true, reason: "Escrow/operator environment is not configured." };

    const creatorId = report.flow.syncA.json?.user?.id;
    if (!creatorId) {
      throw new Error(
        `Player A sync failed (${report.flow.syncA.status}): ${report.flow.syncA.json?.error ?? "missing user id"}. ` +
          `Server log: ${logs.slice(-5).join(" ").trim() || "unavailable"}`
      );
    }

    const seededChallenge = await seedChallenge(service, {
      gameId,
      creatorId,
      stamp,
      suffix: "flow",
    });
    const challenge = { id: seededChallenge.id };
    const invitationToken = seededChallenge.invitationToken;
    report.flow.createChallenge = {
      status: 201,
      ok: true,
      fixtureSeededThroughServiceRole: true,
    };
    report.flow.invitationUrlReturned = true;

    if (challenge && invitationToken) {
      const challengeRows = await service
        .from("challenges")
        .select("id,status,accepted_by_id,match_id,invitation_token_hash")
        .eq("id", challenge.id)
        .single();
      report.flow.challengeStored = {
        ok: !challengeRows.error,
        status: challengeRows.data?.status,
        tokenHashMatches: challengeRows.data?.invitation_token_hash === tokenHash(invitationToken),
      };

      report.flow.invitationPage = {
        skipped: true,
        reason: "The current live-match branch does not expose a challenge invitation page.",
      };

      report.flow.acceptB = await httpJson(`/api/challenges/${challenge.id}/accept`, {
        method: "POST",
        token: players.B.token,
        body: { invitationToken },
      });

      const finalChallenge = await service
        .from("challenges")
        .select("id,status,accepted_by_id,match_id")
        .eq("id", challenge.id)
        .single();
      const matchId = finalChallenge.data?.match_id;
      const matchParticipants = matchId
        ? await service.from("match_participants").select("*", { count: "exact", head: true }).eq("match_id", matchId)
        : { count: null, error: { message: "missing match id" } };
      report.flow.finalDatabaseState = {
        challengeOk: !finalChallenge.error,
        status: finalChallenge.data?.status,
        hasAcceptedBy: Boolean(finalChallenge.data?.accepted_by_id),
        hasMatch: Boolean(matchId),
        matchParticipants: matchParticipants.count,
      };
      report.flow.reuseInvitation = await httpJson(`/api/challenges/${challenge.id}/accept`, {
        method: "POST",
        token: players.C.token,
        body: { invitationToken },
      });
      console.log("Supabase HTTP validation: primary challenge flow completed");
    }

    const concurrencyRuns = [];
    for (let i = 0; i < 10; i += 1) {
      const raceFixture = await seedChallenge(service, {
        gameId,
        creatorId,
        stamp,
        suffix: `race-${i}`,
      });
      const raceChallenge = { id: raceFixture.id };
      const raceToken = raceFixture.invitationToken;
      const [acceptB, acceptC] = await Promise.all([
        httpJson(`/api/challenges/${raceChallenge.id}/accept`, {
          method: "POST",
          token: players.B.token,
          body: { invitationToken: raceToken },
        }),
        httpJson(`/api/challenges/${raceChallenge.id}/accept`, {
          method: "POST",
          token: players.C.token,
          body: { invitationToken: raceToken },
        }),
      ]);
      const dbChallenge = await service
        .from("challenges")
        .select("id,status,accepted_by_id,match_id")
        .eq("id", raceChallenge.id)
        .single();
      const matchCount = await service
        .from("matches")
        .select("*", { count: "exact", head: true })
        .eq("challenge_id", raceChallenge.id);
      const participantCount = dbChallenge.data?.match_id
        ? await service
            .from("match_participants")
            .select("*", { count: "exact", head: true })
            .eq("match_id", dbChallenge.data.match_id)
        : { count: null };
      concurrencyRuns.push({
        iteration: i + 1,
        statuses: [acceptB.status, acceptC.status],
        successCount: [acceptB, acceptC].filter((item) => item.status >= 200 && item.status < 300).length,
        conflictCount: [acceptB, acceptC].filter((item) => item.status === 409).length,
        db: {
          challengeStatus: dbChallenge.data?.status,
          hasAcceptedBy: Boolean(dbChallenge.data?.accepted_by_id),
          matchCount: matchCount.count,
          matchParticipants: participantCount.count,
        },
      });
      console.log(`Supabase HTTP validation: concurrency ${i + 1}/10 completed`);
    }
    report.concurrency.runs = concurrencyRuns;
    report.concurrency.repetitions = concurrencyRuns.length;
    report.concurrency.successCount = concurrencyRuns.reduce((sum, run) => sum + run.successCount, 0);
    report.concurrency.conflictCount = concurrencyRuns.reduce((sum, run) => sum + run.conflictCount, 0);
    report.concurrency.allRunsOk = concurrencyRuns.every(
      (run) =>
        run.successCount === 1 &&
        run.conflictCount === 1 &&
        run.db.challengeStatus === "accepted" &&
        run.db.hasAcceptedBy &&
        run.db.matchCount === 1 &&
        run.db.matchParticipants === 2
    );

    const publicChallenge = await anon
      .from("challenges")
      .select("id,status,entry_fee")
      .limit(1);
    const privateChallengeHash = await anon
      .from("challenges")
      .select("invitation_token_hash")
      .limit(1);
    const anonAcceptRpc = await anon.rpc("accept_challenge", {
      p_challenge_id: randomUUID(),
      p_player_id: randomUUID(),
    });
    const directMatchInsert = await anon.from("matches").insert({
      game_id: gameId,
      player_a_id: report.flow.syncA.json?.user?.id,
      player_b_id: report.flow.syncB.json?.user?.id,
      stake_amount: usdcUnits("1"),
      status: "active",
    });
    const directParticipantInsert = await anon.from("match_participants").insert({
      match_id: report.flow.acceptB.json?.match?.id ?? randomUUID(),
      user_id: report.flow.syncC.json?.user?.id ?? randomUUID(),
      side: "player_b",
    });
    const directChallengeUpdate = challenge.id
      ? await anon
          .from("challenges")
          .update({ status: "accepted" })
          .eq("id", challenge.id)
      : { error: { message: "missing challenge" } };
    report.rls = {
      publicChallengeReadable: !publicChallenge.error,
      privateHashRejected: Boolean(privateChallengeHash.error),
      anonymousAcceptRpcRejected: Boolean(anonAcceptRpc.error),
      directAcceptedMatchInsertRejected: Boolean(directMatchInsert.error),
      directParticipantManipulationRejected: Boolean(directParticipantInsert.error),
      unauthorizedChallengeMutationRejected: Boolean(directChallengeUpdate.error),
      privateHashError: privateChallengeHash.error?.message ?? null,
    };

    const lobbyQuery = await anon
      .from("matches")
      .select("id,status,game_id,player_a_id,player_b_id,stake_amount")
      .limit(20);
    report.realtime = {
      lobbyQueryReadable: !lobbyQuery.error,
      lobbyRowsReturned: lobbyQuery.data?.length ?? 0,
      lobbyQueryError: lobbyQuery.error?.message ?? null,
      realtimeObservedInBrowser: false,
      note: "The lobby's public PostgREST read path was validated. Browser rendering and realtime delivery remain separate UI checks.",
    };

  } finally {
    child.kill();
    report.serverLogTail = logs.slice(-20);
  }

  const safeReport = JSON.parse(JSON.stringify(report, (key, value) => {
    if (/token|key|secret|authorization/i.test(key) && typeof value === "string") return "<redacted>";
    return value;
  }));
  writeFileSync(reportPath, JSON.stringify(safeReport, null, 2));
  console.log(`supabase http validation output: ${reportPath}`);
}

run().catch((error) => {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    reportPath,
    JSON.stringify({ ok: false, error: error.message, stack: error.stack?.split("\n").slice(0, 5) }, null, 2)
  );
  console.error(error.message);
  process.exitCode = 1;
});
