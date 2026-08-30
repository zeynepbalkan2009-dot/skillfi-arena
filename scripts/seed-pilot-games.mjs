import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadDotEnv(path) {
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).map((raw) => raw.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator).replace(/^export\s+/, "").trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")];
  }));
}

const env = loadDotEnv(".env.local");
const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const urlStart = Math.max(rawUrl.indexOf("https://"), rawUrl.indexOf("http://"));
const url = urlStart >= 0 ? rawUrl.slice(urlStart).trim() : rawUrl;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey || /your-|placeholder|^x$/i.test(serviceKey)) throw new Error("A valid Supabase URL and service-role key are required in .env.local");

const games = [
  ["51000000-0000-4000-8000-000000000001", "Typing Sprint", "typing-sprint", "Speed and accuracy typing duel."],
  ["51000000-0000-4000-8000-000000000002", "Arithmetic Rush", "arithmetic-rush", "Deterministic mental arithmetic duel."],
  ["51000000-0000-4000-8000-000000000003", "Sequence Recall", "sequence-recall", "Working-memory sequence challenge."],
  ["51000000-0000-4000-8000-000000000004", "Pattern Lock", "pattern-lock", "Deterministic numeric pattern challenge."],
  ["51000000-0000-4000-8000-000000000005", "Logic Grid", "logic-grid", "True-or-false deductive reasoning duel."],
].map(([id, name, slug, description]) => ({ id, name, slug, description, type: "web2", integration_status: "published", is_active: true }));

const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await client.from("games").upsert(games, { onConflict: "id" }).select("id,name,slug,is_active,integration_status");
if (error) throw new Error(`Pilot game seed failed: ${error.message}`);
if (data?.length !== games.length) throw new Error(`Expected ${games.length} pilot games, received ${data?.length ?? 0}`);
console.log(JSON.stringify({ seeded: data.length, games: data.map(({ name, slug }) => ({ name, slug })) }, null, 2));
