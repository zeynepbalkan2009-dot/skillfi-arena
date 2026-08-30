import assert from "node:assert/strict";
import test from "node:test";
import { createPilotRound, PILOT_GAMES, scorePilotRound } from "../lib/pilotGames.ts";

test("pilot includes five distinct original skill games", () => {
  assert.equal(PILOT_GAMES.length, 5);
  assert.equal(new Set(PILOT_GAMES.map((game) => game.id)).size, 5);
});

for (const game of PILOT_GAMES) test(`${game.name} is deterministic and scoreable`, () => {
  const first = createPilotRound(game.id, "same-match");
  const second = createPilotRound(game.id, "same-match");
  assert.deepEqual(first, second);
  assert.equal(scorePilotRound(first, first.expected).percent, 100);
  assert.ok(scorePilotRound(first, "definitely-wrong").percent < 100);
});
