const baseUrl = (process.env.SKILLFI_LIVE_URL ?? "https://skillfi-arena.vercel.app").replace(/\/$/, "");

async function read(path) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${text.slice(0, 200)}`);
  return { response, text };
}

const health = await read("/api/health");
const healthBody = JSON.parse(health.text);
if (healthBody.status !== "ok" || healthBody.checks?.pilotGames?.published !== 5 || healthBody.checks?.betaCohort?.limit !== 100) throw new Error("Health response does not satisfy pilot readiness");

const sitemap = await read("/sitemap.xml");
const robots = await read("/robots.txt");
if (sitemap.text.includes("localhost") || robots.text.includes("localhost")) throw new Error("Production metadata contains localhost");
if (!sitemap.text.includes(baseUrl) || !robots.text.includes(baseUrl)) throw new Error("Production metadata does not use the canonical URL");

const pilot = await read("/api/pilot/enroll");
const pilotBody = JSON.parse(pilot.text);
if (pilotBody.capacity?.limit !== 100) throw new Error("Pilot capacity endpoint is not ready");

console.log(JSON.stringify({ ok: true, baseUrl, release: healthBody.release, chain: healthBody.chain, publishedPilotGames: 5, activePilotPlayers: healthBody.checks.betaCohort.active, capacity: 100, canonicalMetadata: true }, null, 2));
