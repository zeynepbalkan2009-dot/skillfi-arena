import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const { Client } = pg;
const root = process.cwd();
const outDir = join(root, "tmp", "database-validation");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const dbDir = join(outDir, `pgdata-${runId}`);
const outputPath = join(outDir, "database-validation-output.json");
let port = Number(process.env.SKILLFI_DB_TEST_PORT ?? 55432);
const user = "postgres";
const password = "skillfi_test_password";
const database = "postgres";
const migrationProfile = process.env.SKILLFI_DB_PROFILE === "hosted" ? "hosted" : "local";

let baseConfig = { host: "127.0.0.1", port, user, password, database };
const migration01Name =
  migrationProfile === "hosted" ? "01_initial_schema_hosted_supabase.sql" : "01_initial_schema.sql";
const migration02Name =
  migrationProfile === "hosted"
    ? "02_privy_identity_migration_hosted_supabase.sql"
    : "02_privy_identity_migration.sql";
const migration01 = readFileSync(join(root, migration01Name), "utf8");
const migration02 = readFileSync(join(root, migration02Name), "utf8");
const migration03 = readFileSync(join(root, "03_two_player_challenge_flow.sql"), "utf8");
const validationRolePrelude = `
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;

function invitationHash(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function testWallet(seed) {
  return `0x${createHash("sha256").update(seed, "utf8").digest("hex").slice(0, 40)}`;
}

async function withClient(fn, config = baseConfig) {
  const client = new Client(config);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function canListen(candidatePort) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(candidatePort, "127.0.0.1");
  });
}

async function resolvePort(preferredPort) {
  if (process.env.SKILLFI_DB_TEST_PORT || (await canListen(preferredPort))) {
    return preferredPort;
  }

  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.once("listening", () => {
      const address = server.address();
      server.close(() => {
        resolve(typeof address === "object" && address ? address.port : preferredPort);
      });
    });
    server.listen(0, "127.0.0.1");
  });
}

async function waitForPortToClose(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const client = new Client(baseConfig);
    try {
      await client.connect();
      await client.end().catch(() => {});
      await delay(250);
    } catch {
      return;
    }
  }
}

async function cleanupPortOwner() {
  if (process.platform !== "win32") return;

  spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `$ErrorActionPreference = 'SilentlyContinue'; ` +
        `$connections = Get-NetTCPConnection -LocalPort ${port}; ` +
        `$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique; ` +
        `foreach ($pidValue in $pids) { Stop-Process -Id $pidValue -Force }`,
    ],
    { stdio: "ignore" }
  );
  await delay(500);
}

async function stopEmbeddedPostgres(pgServer, serverStarted) {
  if (!serverStarted) {
    await pgServer.stop().catch(() => {});
    return;
  }

  if (process.platform === "win32") {
    const pid = pgServer.process?.pid;
    if (pid) {
      spawnSync("taskkill", ["/pid", String(pid), "/f", "/t"], { stdio: "ignore" });
      await delay(500);
    }
    await cleanupPortOwner();
    await waitForPortToClose();
    rmSync(dbDir, { recursive: true, force: true });
    return;
  }

  await pgServer.stop().catch(() => {});
}

async function createDatabase(name) {
  await withClient(async (client) => {
    await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${name}`);
  });
}

async function dbClient(name, fn) {
  return withClient(fn, { ...baseConfig, database: name });
}

async function runSql(client, label, sql) {
  const startedAt = Date.now();
  await client.query(sql);
  return { label, ok: true, ms: Date.now() - startedAt };
}

async function applyBaselineAnd02(client) {
  const output = [];
  output.push(await runSql(client, "embedded validation role prelude", validationRolePrelude));
  output.push(await runSql(client, migration01Name, migration01));
  output.push(await runSql(client, migration02Name, migration02));
  return output;
}

async function catalogChecks(client) {
  const tables = await client.query(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('users','games','matches','user_risk_profiles','transactions','challenges','challenge_participants','match_participants')
     ORDER BY table_name
  `);
  const constraints = await client.query(`
    SELECT conname, contype, conrelid::regclass::text AS table_name
      FROM pg_constraint
     WHERE connamespace = 'public'::regnamespace
       AND conrelid::regclass::text IN ('users','matches','challenges','challenge_participants','match_participants')
     ORDER BY table_name, conname
  `);
  const indexes = await client.query(`
    SELECT indexname, tablename
      FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename IN ('users','matches','challenges','challenge_participants','match_participants')
     ORDER BY tablename, indexname
  `);
  const functions = await client.query(`
    SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND proname IN ('accept_challenge','touch_updated_at')
     ORDER BY proname
  `);
  const rls = await client.query(`
    SELECT relname, relrowsecurity
      FROM pg_class
     WHERE relnamespace = 'public'::regnamespace
       AND relname IN ('users','games','matches','user_risk_profiles','transactions','challenges','challenge_participants','match_participants')
     ORDER BY relname
  `);
  const policies = await client.query(`
    SELECT schemaname, tablename, policyname, roles, cmd
      FROM pg_policies
     WHERE schemaname = 'public'
     ORDER BY tablename, policyname
  `);
  const grants = await client.query(`
    SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
     WHERE routine_schema = 'public'
       AND routine_name = 'accept_challenge'
     ORDER BY grantee, privilege_type
  `);
  return {
    tables: tables.rows,
    constraints: constraints.rows,
    indexes: indexes.rows,
    functions: functions.rows,
    rls: rls.rows,
    policies: policies.rows,
    grants: grants.rows,
  };
}

async function seedExistingSchema(client) {
  const ids = {
    game: randomUUID(),
    alice: randomUUID(),
    bob: randomUUID(),
    match: randomUUID(),
  };
  await client.query(
    `INSERT INTO public.games (id, name, type, is_active) VALUES ($1, 'Existing Arena', 'web2', true)`,
    [ids.game]
  );
  await client.query(
    `INSERT INTO public.users (id, username, region, wallet_address, privy_user_id)
     VALUES ($1, 'existing_alice', 'EU', '0x00000000000000000000000000000000000000a1', 'did:privy:existing_alice'),
            ($2, 'existing_bob', 'NA', '0x00000000000000000000000000000000000000b2', 'did:privy:existing_bob')`,
    [ids.alice, ids.bob]
  );
  await client.query(
    `INSERT INTO public.user_risk_profiles (user_id, daily_stake_limit) VALUES ($1, 100000000), ($2, 100000000)`,
    [ids.alice, ids.bob]
  );
  await client.query(
    `INSERT INTO public.matches (id, smart_contract_match_id, game_id, player_a_id, player_b_id, stake_amount, status)
     VALUES ($1, 'legacy-match-1', $2, $3, $4, 5000000, 'searching')`,
    [ids.match, ids.game, ids.alice, ids.bob]
  );
  await client.query(
    `INSERT INTO public.transactions (user_id, match_id, tx_hash) VALUES ($1, $2, '0xlegacy')`,
    [ids.alice, ids.match]
  );
  return ids;
}

async function rowCounts(client) {
  const result = {};
  for (const table of ["users", "games", "matches", "user_risk_profiles", "transactions", "challenges", "challenge_participants", "match_participants"]) {
    const exists = await client.query(`SELECT to_regclass($1) AS name`, [`public.${table}`]);
    if (!exists.rows[0].name) {
      result[table] = null;
      continue;
    }
    const { rows } = await client.query(`SELECT count(*)::int AS count FROM public.${table}`);
    result[table] = rows[0].count;
  }
  return result;
}

async function createChallengeFixture(client, suffix = randomUUID().slice(0, 8), options = {}) {
  const ids = {
    game: randomUUID(),
    creator: randomUUID(),
    playerB1: randomUUID(),
    playerB2: randomUUID(),
    challenge: randomUUID(),
  };
  await client.query(`INSERT INTO public.games (id, name, type, is_active) VALUES ($1, $2, 'web2', true)`, [
    ids.game,
    `Game ${suffix}`,
  ]);
  await client.query(
    `INSERT INTO public.users (id, username, region, wallet_address, privy_user_id)
     VALUES ($1, $4, 'EU', $7, $10),
            ($2, $5, 'EU', $8, $11),
            ($3, $6, 'EU', $9, $12)`,
    [
      ids.creator,
      ids.playerB1,
      ids.playerB2,
      `creator_${suffix}`,
      `acceptor_a_${suffix}`,
      `acceptor_b_${suffix}`,
      testWallet(`creator_${suffix}`),
      testWallet(`acceptor_a_${suffix}`),
      testWallet(`acceptor_b_${suffix}`),
      `did:privy:creator_${suffix}`,
      `did:privy:acceptor_a_${suffix}`,
      `did:privy:acceptor_b_${suffix}`,
    ]
  );
  const token = `token_${suffix}`;
  await client.query(
    `INSERT INTO public.challenges (
       id, invitation_token_hash, idempotency_key, game_id, creator_id, invited_opponent_id,
       entry_fee, currency, opponent_mode, rules, status, expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, 1000000, 'USDC', $7, 'Test rules', $8, $9)`,
    [
      ids.challenge,
      invitationHash(token),
      `idem_${suffix}`,
      ids.game,
      ids.creator,
      options.invitedOpponentId ?? (options.opponentMode === "invite" ? ids.playerB1 : null),
      options.opponentMode ?? "open",
      options.status ?? "open",
      options.expiresAt ?? new Date(Date.now() + 60 * 60_000).toISOString(),
    ]
  );
  await client.query(`INSERT INTO public.challenge_participants (challenge_id, user_id, role) VALUES ($1, $2, 'creator')`, [
    ids.challenge,
    ids.creator,
  ]);
  return { ...ids, token };
}

async function concurrentAcceptanceRun(dbName, iteration) {
  const fixture = await dbClient(dbName, (client) => createChallengeFixture(client, `r${iteration}`));
  const clientA = new Client({ ...baseConfig, database: dbName });
  const clientB = new Client({ ...baseConfig, database: dbName });
  await Promise.all([clientA.connect(), clientB.connect()]);
  try {
    const calls = await Promise.allSettled([
      clientA.query(`SELECT * FROM public.accept_challenge($1, $2)`, [fixture.challenge, fixture.playerB1]),
      clientB.query(`SELECT * FROM public.accept_challenge($1, $2)`, [fixture.challenge, fixture.playerB2]),
    ]);
    const success = calls.filter((result) => result.status === "fulfilled").length;
    const failed = calls.filter((result) => result.status === "rejected").length;
    const state = await dbClient(dbName, async (client) => {
      const challenge = await client.query(`SELECT status, accepted_by_id, match_id FROM public.challenges WHERE id = $1`, [
        fixture.challenge,
      ]);
      const matches = await client.query(`SELECT id, player_a_id, player_b_id, status FROM public.matches WHERE challenge_id = $1`, [
        fixture.challenge,
      ]);
      const matchParticipants = await client.query(
        `SELECT count(*)::int AS count FROM public.match_participants WHERE match_id = $1`,
        [challenge.rows[0].match_id]
      );
      const challengeParticipants = await client.query(
        `SELECT count(*)::int AS count FROM public.challenge_participants WHERE challenge_id = $1`,
        [fixture.challenge]
      );
      return {
        challenge: challenge.rows[0],
        matches: matches.rows,
        matchParticipants: matchParticipants.rows[0].count,
        challengeParticipants: challengeParticipants.rows[0].count,
      };
    });
    return {
      iteration,
      success,
      failed,
      errors: calls
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason?.message ?? String(result.reason)),
      state,
    };
  } finally {
    await Promise.allSettled([clientA.end(), clientB.end()]);
  }
}

async function failureCases(dbName) {
  return dbClient(dbName, async (client) => {
    const cases = [];
    async function capture(name, fn) {
      try {
        const result = await fn();
        cases.push({ name, ok: true, result: result?.rows ?? null });
      } catch (error) {
        cases.push({ name, ok: false, message: error.message });
      }
    }

    const self = await createChallengeFixture(client, "self");
    await capture("creator attempting self-acceptance", () =>
      client.query(`SELECT * FROM public.accept_challenge($1, $2)`, [self.challenge, self.creator])
    );

    const expired = await createChallengeFixture(client, "expired", {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    await capture("expired invitation", () =>
      client.query(`SELECT * FROM public.accept_challenge($1, $2)`, [expired.challenge, expired.playerB1])
    );

    const wrongInvite = await createChallengeFixture(client, "wrong", { opponentMode: "invite" });
    await client.query(`UPDATE public.challenges SET invited_opponent_id = $1 WHERE id = $2`, [
      wrongInvite.playerB1,
      wrongInvite.challenge,
    ]);
    await capture("wrong invited opponent", () =>
      client.query(`SELECT * FROM public.accept_challenge($1, $2)`, [wrongInvite.challenge, wrongInvite.playerB2])
    );

    const accepted = await createChallengeFixture(client, "used");
    await capture("valid first acceptance", () =>
      client.query(`SELECT * FROM public.accept_challenge($1, $2)`, [accepted.challenge, accepted.playerB1])
    );
    await capture("already-used invitation", () =>
      client.query(`SELECT * FROM public.accept_challenge($1, $2)`, [accepted.challenge, accepted.playerB2])
    );

    await capture("missing user", () =>
      client.query(`SELECT * FROM public.accept_challenge($1, $2)`, [accepted.challenge, randomUUID()])
    );
    await capture("missing challenge", () =>
      client.query(`SELECT * FROM public.accept_challenge($1, $2)`, [randomUUID(), accepted.playerB1])
    );

    const invalidHash = await client.query(`SELECT id FROM public.challenges WHERE invitation_token_hash = $1`, [
      invitationHash("not-the-token"),
    ]);
    cases.push({ name: "invalid invitation hash", ok: invalidHash.rowCount === 0, rowCount: invalidHash.rowCount });

    const revoked = await createChallengeFixture(client, "revoked", { status: "cancelled" });
    await capture("revoked invitation", () =>
      client.query(`SELECT * FROM public.accept_challenge($1, $2)`, [revoked.challenge, revoked.playerB1])
    );

    const duplicate = await createChallengeFixture(client, "idem");
    const duplicateRows = await client.query(
      `SELECT count(*)::int AS count FROM public.challenges WHERE creator_id = $1 AND idempotency_key = $2`,
      [duplicate.creator, "idem_idem"]
    );
    cases.push({ name: "duplicate request with same idempotency key", ok: duplicateRows.rows[0].count === 1 });

    return cases;
  });
}

async function rlsChecks(dbName) {
  return dbClient(dbName, async (client) => {
    const fixture = await createChallengeFixture(client, "rls");
    const checks = [];

    async function asRole(role, sql, params = []) {
      await client.query("BEGIN");
      await client.query(`SET LOCAL ROLE ${role}`);
      try {
        const result = await client.query(sql, params);
        await client.query("COMMIT");
        return { ok: true, rows: result.rows, rowCount: result.rowCount };
      } catch (error) {
        await client.query("ROLLBACK");
        return { ok: false, message: error.message };
      }
    }

    checks.push({
      name: "anon can read safe public challenge columns",
      result: await asRole("anon", `SELECT id, status, entry_fee FROM public.challenges WHERE id = $1`, [
        fixture.challenge,
      ]),
    });
    checks.push({
      name: "anon cannot read invitation_token_hash column",
      result: await asRole("anon", `SELECT invitation_token_hash FROM public.challenges WHERE id = $1`, [fixture.challenge]),
    });
    checks.push({
      name: "authenticated cannot edit another profile",
      result: await asRole("authenticated", `UPDATE public.users SET username = 'taken_over' WHERE id = $1`, [
        fixture.creator,
      ]),
    });
    checks.push({
      name: "authenticated cannot modify statistics",
      result: await asRole("authenticated", `UPDATE public.users SET wins = 99 WHERE id = $1`, [fixture.creator]),
    });
    checks.push({
      name: "authenticated cannot assign wallet or Privy DID",
      result: await asRole("authenticated", `UPDATE public.users SET wallet_address = '0xabc', privy_user_id = 'did:privy:evil' WHERE id = $1`, [
        fixture.creator,
      ]),
    });
    checks.push({
      name: "authenticated cannot directly insert accepted matches",
      result: await asRole(
        "authenticated",
        `INSERT INTO public.matches (game_id, player_a_id, player_b_id, stake_amount, status) VALUES ($1, $2, $3, 1, 'active')`,
        [fixture.game, fixture.creator, fixture.playerB1]
      ),
    });
    checks.push({
      name: "anon cannot bypass acceptance RPC",
      result: await asRole("anon", `SELECT * FROM public.accept_challenge($1, $2)`, [fixture.challenge, fixture.playerB1]),
    });

    return checks;
  });
}

async function cleanDatabaseValidation() {
  const dbName = "skillfi_clean";
  await createDatabase(dbName);
  return dbClient(dbName, async (client) => {
    const output = await applyBaselineAnd02(client);
    output.push(await runSql(client, "03_two_player_challenge_flow.sql", migration03));
    return { output, catalog: await catalogChecks(client), counts: await rowCounts(client) };
  });
}

async function existingSchemaValidation() {
  const dbName = "skillfi_existing";
  await createDatabase(dbName);
  return dbClient(dbName, async (client) => {
    const output = await applyBaselineAnd02(client);
    const seedIds = await seedExistingSchema(client);
    const before = await rowCounts(client);
    output.push(await runSql(client, "03_two_player_challenge_flow.sql", migration03));
    const after = await rowCounts(client);
    const legacyMatch = await client.query(`SELECT id, stake_amount, status, currency FROM public.matches WHERE id = $1`, [
      seedIds.match,
    ]);
    let rerun;
    try {
      rerun = await runSql(client, "03_two_player_challenge_flow.sql rerun", migration03);
    } catch (error) {
      rerun = { label: "03_two_player_challenge_flow.sql rerun", ok: false, message: error.message };
    }
    return { output, seedIds, before, after, legacyMatch: legacyMatch.rows[0], rerun, catalog: await catalogChecks(client) };
  });
}

async function concurrencyValidation() {
  const dbName = "skillfi_concurrency";
  await createDatabase(dbName);
  await dbClient(dbName, async (client) => {
    await applyBaselineAnd02(client);
    await runSql(client, "03_two_player_challenge_flow.sql", migration03);
  });
  const runs = [];
  for (let i = 1; i <= 10; i += 1) {
    runs.push(await concurrentAcceptanceRun(dbName, i));
  }
  const failures = await failureCases(dbName);
  const rls = await rlsChecks(dbName);
  const counts = await dbClient(dbName, rowCounts);
  return { runs, failures, rls, counts };
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  port = await resolvePort(port);
  baseConfig = { host: "127.0.0.1", port, user, password, database };

  const pgServer = new EmbeddedPostgres({
    databaseDir: dbDir,
    user,
    password,
    port,
    persistent: false,
    initdbFlags: ["--locale=C", "--encoding=UTF8"],
    onLog: () => {},
    onError: () => {},
  });
  let serverStarted = false;

  const report = {
    environment: {
      type: "embedded-postgres",
      migrationProfile,
      host: "127.0.0.1",
      port,
      database,
      user,
    package: "embedded-postgres",
    },
    migrations: [migration01Name, migration02Name, "03_two_player_challenge_flow.sql"],
    startedAt: new Date().toISOString(),
  };

  try {
    await pgServer.initialise();
    await pgServer.start();
    serverStarted = true;
    report.clean = await cleanDatabaseValidation();
    report.existing = await existingSchemaValidation();
    report.concurrency = await concurrencyValidation();
    report.ok = true;
  } catch (error) {
    report.ok = false;
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    report.error = {
      message: normalizedError.message,
      stack: normalizedError.stack,
    };
    throw normalizedError;
  } finally {
    report.finishedAt = new Date().toISOString();
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    await stopEmbeddedPostgres(pgServer, serverStarted);
    console.log(`database validation output: ${outputPath}`);
  }
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
