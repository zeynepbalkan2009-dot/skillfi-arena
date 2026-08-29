import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    }));
}

const env = loadEnv(".env.integration.local");
const secret = env.SKILLFI_TEST_API_KEY;
if (!secret) throw new Error("SKILLFI_TEST_API_KEY is missing from .env.integration.local");
const endpoint = `${process.env.SKILLFI_BASE_URL || "http://localhost:3000"}/api/integrations/v1/results`;
const rawBody = JSON.stringify({
  eventId: `smoke_${Date.now()}`,
  matchId: "00000000-0000-0000-0000-000000000000",
  winnerWallet: "0x0000000000000000000000000000000000000001",
  occurredAt: new Date().toISOString(),
});
const timestamp = Date.now().toString();
const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
const headers = { "content-type": "application/json", authorization: `Bearer ${secret}`, "x-skillfi-timestamp": timestamp };

const invalid = await fetch(endpoint, { method: "POST", headers: { ...headers, "x-skillfi-signature": "0".repeat(64) }, body: rawBody });
const invalidBody = await invalid.json().catch(() => ({}));
if (invalid.status !== 401 || invalidBody.error !== "Invalid or expired request signature") {
  throw new Error(`Invalid-signature guard failed (${invalid.status}: ${JSON.stringify(invalidBody)})`);
}

const authenticated = await fetch(endpoint, { method: "POST", headers: { ...headers, "x-skillfi-signature": signature }, body: rawBody });
const authenticatedBody = await authenticated.json().catch(() => ({}));
if (authenticated.status !== 404 || authenticatedBody.error !== "Match not found") {
  throw new Error(`Signed request did not pass authentication (${authenticated.status}: ${JSON.stringify(authenticatedBody)})`);
}

console.log(JSON.stringify({ invalidSignatureRejected: true, signedCredentialAccepted: true, expectedBusinessResponse: authenticatedBody.error }, null, 2));
