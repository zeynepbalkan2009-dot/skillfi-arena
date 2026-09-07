import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

test("landing page presents the controlled pilot without reward claims", () => {
  const landing = readFileSync(
    join(root, "components/LandingPage.tsx"),
    "utf8",
  );
  const marketing = readFileSync(
    join(root, "components/MarketingSections.tsx"),
    "utf8",
  );
  const copy = `${landing}\n${marketing}`;

  assert.match(copy, /Controlled pilot/);
  assert.match(copy, /five\s+deterministic games/);
  assert.match(copy, /does not promise cash, tokens/);
  assert.match(copy, /Value-bearing\s+settlement infrastructure is not part/);
  assert.doesNotMatch(copy, /10 \+ 10 USDC/);
  assert.doesNotMatch(copy, /Winner payout/);
  assert.doesNotMatch(copy, /Equal deposits/);
});
