import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createPilotRound, PILOT_GAMES, scorePilotRound } from "../lib/pilotGames.ts";

function loadEnv(path) {
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")];
  }));
}

const env = loadEnv(".env.local");
const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const urlStart = rawUrl.includes("https://") ? rawUrl.indexOf("https://") : rawUrl.indexOf("http://");
const url = urlStart >= 0 ? rawUrl.slice(urlStart).trim() : rawUrl;
if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Hosted Supabase configuration is required");
const service = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const slugs = PILOT_GAMES.map((game) => game.id);
const { data, error } = await service.from("games").select("id,name,slug,is_active,integration_status").in("slug", slugs);
if (error) throw new Error(`Hosted game lookup failed: ${error.message}`);

const hosted = new Map((data ?? []).map((game) => [game.slug, game]));
const results = PILOT_GAMES.map((game, index) => {
  const record = hosted.get(game.id);
  if (!record || !record.is_active || record.integration_status !== "published") throw new Error(`${game.name} is not an active published hosted game`);
  const matchId = `acceptance-match-${index + 1}`;
  const playerARound = createPilotRound(game.id, matchId);
  const playerBRound = createPilotRound(game.id, matchId);
  if (JSON.stringify(playerARound) !== JSON.stringify(playerBRound)) throw new Error(`${game.name} did not produce an identical round for both players`);
  const playerA = scorePilotRound(playerARound, playerARound.expected);
  const playerB = scorePilotRound(playerBRound, "incorrect");
  if (playerA.percent !== 100 || playerA.points <= playerB.points) throw new Error(`${game.name} ranking acceptance failed`);
  return { game: game.name, slug: game.id, sameRound: true, serverScoreA: playerA.percent, serverScoreB: playerB.percent, expectedWinner: "player-a" };
});

console.log(JSON.stringify({ hostedGames: results.length, twoPlayerDeterminism: true, serverRanking: true, results }, null, 2));
