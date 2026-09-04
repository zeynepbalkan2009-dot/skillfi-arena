import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const lockfilePath = process.argv[2] ?? "package-lock.json";
const registry = (process.env.NPM_CONFIG_REGISTRY ?? "https://registry.npmjs.org/").replace(/\/+$/, "");
const npmAdvisoryUrl = `${registry}/-/npm/v1/security/advisories/bulk`;
const osvBaseUrl = "https://api.osv.dev/v1";
const FAIL_SEVERITIES = new Set(["high", "critical"]);
const SAFE_SEVERITIES = new Set(["low", "moderate", "medium"]);

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

async function fetchWithRetry(url, options, label, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const raw = Buffer.from(await response.arrayBuffer());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${decodeAdvisoryBody(raw).slice(0, 500)}`);
      }
      return JSON.parse(decodeAdvisoryBody(raw));
    } catch (error) {
      lastError = error;
      console.error(`${label} attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error(`${label} failed`);
}

async function requestNpmAdvisories(payload) {
  const parsed = await fetchWithRetry(
    npmAdvisoryUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "identity",
        "User-Agent": "skillfi-production-advisory-gate/2.0",
      },
      body: JSON.stringify(payload),
    },
    "npm Bulk Advisory request",
  );
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("npm registry returned an invalid advisory response shape");
  }
  for (const [name, entries] of Object.entries(parsed)) {
    if (!Array.isArray(entries)) throw new Error(`npm registry returned a non-array advisory list for ${name}`);
  }
  return parsed;
}

function npmHighOrCriticalFindings(advisories) {
  const findings = [];
  for (const [packageName, entries] of Object.entries(advisories)) {
    for (const advisory of entries) {
      const severity = String(advisory?.severity ?? "unknown").toLowerCase();
      if (!FAIL_SEVERITIES.has(severity)) continue;
      findings.push({
        source: "npm",
        package: packageName,
        severity,
        title: advisory?.title ?? "Untitled advisory",
        url: advisory?.url ?? null,
        vulnerableVersions: advisory?.vulnerable_versions ?? null,
      });
    }
  }
  return findings;
}

function inventoryPairs(inventory) {
  return Object.entries(inventory).flatMap(([name, versions]) =>
    versions.map((version) => ({ name, version })),
  );
}

async function queryOsvBatch(pairs) {
  const matches = [];
  for (let start = 0; start < pairs.length; start += 500) {
    const chunk = pairs.slice(start, start + 500);
    const response = await fetchWithRetry(
      `${osvBaseUrl}/querybatch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          queries: chunk.map(({ name, version }) => ({
            package: { ecosystem: "npm", name },
            version,
          })),
        }),
      },
      "OSV querybatch",
    );
    if (!Array.isArray(response?.results) || response.results.length !== chunk.length) {
      throw new Error("OSV querybatch returned an invalid result shape");
    }
    response.results.forEach((result, index) => {
      if (result?.next_page_token) {
        throw new Error(`OSV pagination required for ${chunk[index].name}@${chunk[index].version}; refusing an incomplete scan`);
      }
      for (const vuln of result?.vulns ?? []) {
        if (!vuln?.id) throw new Error("OSV returned a vulnerability without an id");
        matches.push({ ...chunk[index], id: vuln.id });
      }
    });
  }
  return matches;
}

async function fetchOsvDetails(ids) {
  const details = new Map();
  const unique = [...new Set(ids)];
  for (let start = 0; start < unique.length; start += 12) {
    const chunk = unique.slice(start, start + 12);
    const records = await Promise.all(
      chunk.map(async (id) => [
        id,
        await fetchWithRetry(
          `${osvBaseUrl}/vulns/${encodeURIComponent(id)}`,
          { headers: { Accept: "application/json" } },
          `OSV vulnerability ${id}`,
        ),
      ]),
    );
    for (const [id, record] of records) details.set(id, record);
  }
  return details;
}

function normalizeSeverity(record, packageName) {
  const candidates = [
    record?.database_specific?.severity,
    record?.ecosystem_specific?.severity,
  ];
  for (const affected of record?.affected ?? []) {
    if (affected?.package?.ecosystem === "npm" && affected?.package?.name === packageName) {
      candidates.push(affected?.ecosystem_specific?.severity, affected?.database_specific?.severity);
    }
  }
  for (const candidate of candidates) {
    const normalized = String(candidate ?? "").toLowerCase();
    if (FAIL_SEVERITIES.has(normalized) || SAFE_SEVERITIES.has(normalized)) return normalized;
  }
  // OSV records can omit a textual severity even when a vulnerability exists.
  // Fail closed rather than silently treating an unclassified advisory as safe.
  return "unknown";
}

async function scanWithOsv(inventory) {
  const matches = await queryOsvBatch(inventoryPairs(inventory));
  if (matches.length === 0) return [];
  const details = await fetchOsvDetails(matches.map((match) => match.id));
  const findings = [];
  const seen = new Set();
  for (const match of matches) {
    const key = `${match.name}@${match.version}:${match.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const record = details.get(match.id);
    if (!record) throw new Error(`Missing OSV detail for ${match.id}`);
    const severity = normalizeSeverity(record, match.name);
    if (!FAIL_SEVERITIES.has(severity) && severity !== "unknown") continue;
    findings.push({
      source: "OSV",
      package: `${match.name}@${match.version}`,
      severity,
      id: match.id,
      title: record.summary ?? record.details?.slice(0, 160) ?? "Untitled OSV advisory",
      url: `https://osv.dev/vulnerability/${match.id}`,
    });
  }
  return findings;
}

const lock = JSON.parse(await readFile(lockfilePath, "utf8"));
const inventory = buildProductionInventory(lock);
const packageCount = Object.keys(inventory).length;
if (packageCount === 0) throw new Error("Production dependency inventory is empty; refusing to pass the advisory gate");

let source = "npm";
let findings;
try {
  const canary = await requestNpmAdvisories({ lodash: ["4.17.20"] });
  if (npmHighOrCriticalFindings(canary).length === 0) {
    throw new Error("npm advisory canary did not return the expected high-severity lodash 4.17.20 finding");
  }
  findings = npmHighOrCriticalFindings(await requestNpmAdvisories(inventory));
} catch (npmError) {
  source = "OSV";
  console.warn("npm advisory service unavailable or invalid; switching to fail-closed OSV fallback:", npmError instanceof Error ? npmError.message : npmError);
  const canaryFindings = await scanWithOsv({ lodash: ["4.17.20"] });
  if (canaryFindings.length === 0) {
    throw new Error("OSV canary did not return a blocking finding for lodash 4.17.20");
  }
  findings = await scanWithOsv(inventory);
}

if (findings.length > 0) {
  console.error(`Found ${findings.length} blocking production dependency advisories via ${source}:`);
  for (const finding of findings) console.error(JSON.stringify(finding));
  process.exit(1);
}

console.log(`Production advisory gate passed via ${source} for ${packageCount} installed package names: no high/critical or unclassified OSV advisories remain.`);
