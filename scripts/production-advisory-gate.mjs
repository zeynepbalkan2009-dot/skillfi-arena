import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const lockfilePath = process.argv[2] ?? "package-lock.json";
const registry = (process.env.NPM_CONFIG_REGISTRY ?? "https://registry.npmjs.org/").replace(/\/+$/, "");
const advisoryUrl = `${registry}/-/npm/v1/security/advisories/bulk`;
const FAIL_SEVERITIES = new Set(["high", "critical"]);

function packageNameFromPath(path) {
  const marker = "node_modules/";
  const index = path.lastIndexOf(marker);
  if (index === -1) return null;
  const remainder = path.slice(index + marker.length);
  if (!remainder) return null;
  const parts = remainder.split("/");
  return parts[0]?.startsWith("@") && parts[1]
    ? `${parts[0]}/${parts[1]}`
    : parts[0] ?? null;
}

function buildProductionInventory(lock) {
  if (!lock?.packages || typeof lock.packages !== "object") {
    throw new Error("package-lock.json must contain a packages object (lockfileVersion 2 or newer)");
  }

  const versionsByName = new Map();
  for (const [path, metadata] of Object.entries(lock.packages)) {
    if (!path || !metadata || metadata.dev === true || typeof metadata.version !== "string") continue;
    const name = metadata.name ?? packageNameFromPath(path);
    if (!name) continue;
    const versions = versionsByName.get(name) ?? new Set();
    versions.add(metadata.version);
    versionsByName.set(name, versions);
  }

  return Object.fromEntries(
    [...versionsByName.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, versions]) => [name, [...versions].sort()]),
  );
}

function decodeAdvisoryBody(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return gunzipSync(buffer).toString("utf8");
  }
  return buffer.toString("utf8");
}

async function requestAdvisories(payload) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(advisoryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "identity",
          "User-Agent": "skillfi-production-advisory-gate/1.0",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (!response.ok) {
        throw new Error(`registry returned HTTP ${response.status}: ${decodeAdvisoryBody(raw).slice(0, 500)}`);
      }
      return JSON.parse(decodeAdvisoryBody(raw));
    } catch (error) {
      lastError = error;
      console.error(`Production advisory request attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error("Production advisory request failed");
}

const lock = JSON.parse(await readFile(lockfilePath, "utf8"));
const inventory = buildProductionInventory(lock);
const packageCount = Object.keys(inventory).length;
if (packageCount === 0) throw new Error("Production dependency inventory is empty; refusing to pass the audit gate");

const advisories = await requestAdvisories(inventory);
const findings = [];
for (const [packageName, entries] of Object.entries(advisories ?? {})) {
  if (!Array.isArray(entries)) continue;
  for (const advisory of entries) {
    const severity = String(advisory?.severity ?? "unknown").toLowerCase();
    if (!FAIL_SEVERITIES.has(severity)) continue;
    findings.push({
      package: packageName,
      severity,
      title: advisory?.title ?? "Untitled advisory",
      url: advisory?.url ?? null,
      vulnerableVersions: advisory?.vulnerable_versions ?? null,
    });
  }
}

if (findings.length > 0) {
  console.error(`Found ${findings.length} high/critical production dependency advisories:`);
  for (const finding of findings) console.error(JSON.stringify(finding));
  process.exit(1);
}

console.log(`Production advisory gate passed for ${packageCount} installed package names: no high/critical advisories returned.`);
