const baseUrl = (process.env.SKILLFI_LOAD_URL ?? "http://localhost:3000").replace(/\/$/, "");
const virtualUsers = Number(process.env.SKILLFI_LOAD_USERS ?? 100);
const paths = ["/", "/games", "/pilot", "/pilot/games", "/guilds", "/api/guilds", "/api/pilot/enroll", "/terms", "/privacy"];

if (!Number.isInteger(virtualUsers) || virtualUsers < 1 || virtualUsers > 500) throw new Error("SKILLFI_LOAD_USERS must be an integer from 1 to 500");

for (const path of paths) {
  const warmup = await fetch(`${baseUrl}${path}`, { redirect: "follow", signal: AbortSignal.timeout(60_000) }).catch(() => null);
  if (!warmup?.ok) throw new Error(`Warm-up failed for ${path}${warmup ? ` (${warmup.status})` : ""}. Start the app before running the load test.`);
  await warmup.arrayBuffer();
}

const startedAt = performance.now();
const results = await Promise.all(Array.from({ length: virtualUsers }, async (_, index) => {
  const path = paths[index % paths.length];
  const requestStarted = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
    await response.arrayBuffer();
    return { ok: response.ok, status: response.status, path, durationMs: performance.now() - requestStarted };
  } catch (error) {
    return { ok: false, status: 0, path, durationMs: performance.now() - requestStarted, error: error instanceof Error ? error.message : String(error) };
  }
}));

const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);
const failures = results.filter((result) => !result.ok);
const percentile = (ratio) => durations[Math.min(durations.length - 1, Math.floor(durations.length * ratio))];
const report = {
  target: baseUrl,
  virtualUsers,
  passed: results.length - failures.length,
  failed: failures.length,
  wallTimeMs: Math.round(performance.now() - startedAt),
  p50Ms: Math.round(percentile(0.5)),
  p95Ms: Math.round(percentile(0.95)),
  maxMs: Math.round(durations.at(-1) ?? 0),
  paths: Object.fromEntries(paths.map((path) => {
    const rows = results.filter((result) => result.path === path);
    const pathDurations = rows.map((result) => result.durationMs).sort((a, b) => a - b);
    return [path, { requests: rows.length, passed: rows.filter((result) => result.ok).length, p95Ms: Math.round(pathDurations[Math.min(pathDurations.length - 1, Math.floor(pathDurations.length * 0.95))] ?? 0) }];
  })),
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  console.error("First failures:", failures.slice(0, 5));
  process.exitCode = 1;
}
