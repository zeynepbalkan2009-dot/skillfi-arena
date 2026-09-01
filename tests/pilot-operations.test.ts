import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("controlled pilot runbook requires ownership and explicit stop conditions", () => {
  const runbook = readFileSync("app/pilot/runbook/page.tsx", "utf8");
  const admin = readFileSync("components/PilotAdminClient.tsx", "utf8");
  assert.match(runbook, /backup incident owner/);
  assert.match(runbook, /NO-GO/);
  assert.match(runbook, /Pause new matches immediately/);
  assert.match(runbook, /production asset/i);
  assert.match(admin, /SESSION RUNBOOK/);
});
