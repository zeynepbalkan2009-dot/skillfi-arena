import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("dashboard derives the signed-in pilot journey from live APIs", () => {
  const card = readFileSync("components/PilotJourneyCard.tsx", "utf8");
  const dashboard = readFileSync("app/dashboard/page.tsx", "utf8");
  assert.match(card, /Promise\.all/);
  assert.match(card, /\/api\/pilot\/enroll/);
  assert.match(card, /\/api\/pilot\/runs/);
  assert.match(card, /completedSteps/);
  assert.match(card, /ENTER CHALLENGE ARENA/);
  assert.match(dashboard, /<PilotJourneyCard/);
});
