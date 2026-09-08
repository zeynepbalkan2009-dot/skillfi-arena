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

  assert.match(copy, /Founders(?:&apos;|') pilot/);
  assert.match(copy, /Five original skill games/);
  assert.match(copy, /No entry fee, token sale or\s+real-value prize pool/);
  assert.match(copy, /Value-bearing\s+settlement infrastructure is not part/);
  assert.doesNotMatch(copy, /10 \+ 10 USDC/);
  assert.doesNotMatch(copy, /Winner payout/);
  assert.doesNotMatch(copy, /Equal deposits/);
});
