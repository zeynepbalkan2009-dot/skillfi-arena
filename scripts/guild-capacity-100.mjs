import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

const { Client } = pg;
const root = process.cwd();
const userCount = Number(process.env.SKILLFI_GUILD_USERS ?? 100);
const guildCount = Number(process.env.SKILLFI_GUILD_COUNT ?? 10);

if (!Number.isInteger(userCount) || userCount < 100 || userCount > 500) throw new Error("SKILLFI_GUILD_USERS must be an integer from 100 to 500");
if (!Number.isInteger(guildCount) || guildCount < 2 || guildCount > userCount) throw new Error("SKILLFI_GUILD_COUNT must be between 2 and the user count");

const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});
const databaseDir = join(root, "tmp", `guild-capacity-${Date.now()}`);
mkdirSync(join(root, "tmp"), { recursive: true });

const server = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "skillfi_guild_capacity",
  port,
  persistent: false,
  initdbFlags: ["--locale=C", "--encoding=UTF8"],
  onLog: () => {},
  onError: () => {},
});
const client = new Client({ host: "127.0.0.1", port, user: "postgres", password: "skillfi_guild_capacity", database: "postgres" });
const migrationFiles = [
  "01_initial_schema.sql",
  "02_privy_identity_migration.sql",
  "03_two_player_challenge_flow.sql",
  "supabase/03_live_matches.sql",
  "supabase/04_match_audit_events.sql",
  "supabase/05_risk_stake_reservations.sql",
  "supabase/06_transaction_event_identity.sql",
  "supabase/07_match_disputes.sql",
  "supabase/08_studio_game_onboarding.sql",
  "supabase/09_guild_dao.sql",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const startedAt = performance.now();
try {
  await server.initialise();
  await server.start();
  await client.connect();
  await client.query(`
    DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE PUBLICATION supabase_realtime; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  for (const file of migrationFiles) await client.query(readFileSync(join(root, file), "utf8"));

  await client.query("BEGIN");
  try {
    for (let index = 0; index < userCount; index += 1) {
      await client.query(
        `INSERT INTO public.users (privy_user_id, username, region) VALUES ($1, $2, 'EU')`,
        [`capacity:player:${index}`, `capacity_player_${index}`]
      );
    }
    const users = (await client.query(`SELECT id FROM public.users WHERE privy_user_id LIKE 'capacity:player:%' ORDER BY username`)).rows;
    assert(users.length === userCount, `Expected ${userCount} users, received ${users.length}`);

    const guilds = [];
    for (let index = 0; index < guildCount; index += 1) {
      const result = await client.query(
        `SELECT (public.create_guild_with_owner($1, $2, $3, $4, $5)).id AS id`,
        [users[index].id, `Capacity Guild ${index + 1}`, `capacity-guild-${index + 1}`, "Isolated capacity fixture", "⬢"]
      );
      guilds.push(result.rows[0].id);
    }
    for (let index = guildCount; index < users.length; index += 1) {
      await client.query(`INSERT INTO public.guild_members (guild_id, user_id, role) VALUES ($1, $2, 'member')`, [guilds[index % guildCount], users[index].id]);
    }

    const proposals = [];
    for (let index = 0; index < guildCount; index += 1) {
      const result = await client.query(
        `INSERT INTO public.guild_proposals (guild_id, proposer_user_id, title, description, proposal_type, closes_at)
         VALUES ($1, $2, $3, $4, 'strategy', now() + interval '3 days') RETURNING id`,
        [guilds[index], users[index].id, `Capacity strategy ${index + 1}`, "Validate coordinated guild voting under load."]
      );
      proposals.push(result.rows[0].id);
    }
    const memberships = (await client.query(`SELECT guild_id, user_id FROM public.guild_members ORDER BY joined_at, user_id`)).rows;
    for (const membership of memberships) {
      const guildIndex = guilds.indexOf(membership.guild_id);
      await client.query(`INSERT INTO public.guild_votes (proposal_id, voter_user_id, choice) VALUES ($1, $2, 'for')`, [proposals[guildIndex], membership.user_id]);
    }

    const counts = (await client.query(`SELECT
      (SELECT count(*)::int FROM public.guilds) AS guilds,
      (SELECT count(*)::int FROM public.guild_members) AS members,
      (SELECT count(*)::int FROM public.guild_proposals) AS proposals,
      (SELECT count(*)::int FROM public.guild_votes) AS votes`)).rows[0];
    assert(counts.guilds === guildCount, "Guild count mismatch");
    assert(counts.members === userCount, "Membership count mismatch");
    assert(counts.proposals === guildCount, "Proposal count mismatch");
    assert(counts.votes === userCount, "Vote count mismatch");

    let duplicateMembershipRejected = false;
    await client.query("SAVEPOINT duplicate_membership_check");
    try { await client.query(`INSERT INTO public.guild_members (guild_id, user_id, role) VALUES ($1, $2, 'member')`, [guilds[1], users[0].id]); }
    catch (error) { duplicateMembershipRejected = error.code === "23505"; }
    await client.query("ROLLBACK TO SAVEPOINT duplicate_membership_check");
    assert(duplicateMembershipRejected, "One-guild-per-player constraint did not reject a duplicate membership");

    await client.query(`INSERT INTO public.guild_treasury_events (guild_id, event_type, amount, idempotency_key) VALUES ($1, 'capacity_credit', 1000000, 'capacity-credit-1')`, [guilds[0]]);
    let ledgerMutationRejected = false;
    await client.query("SAVEPOINT ledger_mutation_check");
    try { await client.query(`UPDATE public.guild_treasury_events SET amount = 2 WHERE idempotency_key = 'capacity-credit-1'`); }
    catch (error) { ledgerMutationRejected = /immutable/i.test(error.message); }
    await client.query("ROLLBACK TO SAVEPOINT ledger_mutation_check");
    assert(ledgerMutationRejected, "Immutable treasury ledger accepted an update");

    await client.query("ROLLBACK");
    console.log(JSON.stringify({
      ok: true,
      isolated: true,
      users: userCount,
      guilds: guildCount,
      members: counts.members,
      proposals: counts.proposals,
      votes: counts.votes,
      duplicateMembershipRejected,
      ledgerMutationRejected,
      durationMs: Math.round(performance.now() - startedAt),
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
} finally {
  await client.end().catch(() => {});
  await server.stop().catch(() => {});
  try { rmSync(databaseDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 500 }); }
  catch { console.warn(`Temporary database cleanup deferred: ${databaseDir}`); }
}
