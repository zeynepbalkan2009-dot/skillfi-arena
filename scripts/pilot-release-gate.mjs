import { spawn } from "node:child_process";

const liveUrl = (process.env.SKILLFI_LIVE_URL ?? "https://skillfi-arena.vercel.app").replace(/\/$/, "");
const steps = [
  { name: "TypeScript", command: "npm run typecheck" },
  { name: "Product tests", command: "npm run test:product" },
  { name: "100-player guild capacity", command: "npm run test:guild:100" },
  {
    name: "Live readiness",
    command: "npm run test:live",
    env: { SKILLFI_LIVE_URL: liveUrl },
  },
  {
    name: "100-user live load",
    command: "npm run test:load:100",
    env: { SKILLFI_LOAD_URL: liveUrl, SKILLFI_LOAD_USERS: "100" },
  },
];

function run(step) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${step.name} ===`);
    const child = spawn(step.command, {
      cwd: process.cwd(),
      env: { ...process.env, ...step.env },
      shell: true,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(`${step.name} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`));
    });
  });
}

const startedAt = Date.now();
for (const step of steps) await run(step);

console.log(JSON.stringify({
  ok: true,
  gate: "five-game-100-player-pilot",
  target: liveUrl,
  checks: steps.map((step) => step.name),
  durationSeconds: Math.round((Date.now() - startedAt) / 1000),
}, null, 2));
