import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const source = readFileSync("components/motion/WaitingMotion.tsx", "utf8");
const challengeLoading = readFileSync("app/challenges/loading.tsx", "utf8");
const matchLoading = readFileSync("app/match/[id]/loading.tsx", "utf8");
const challengeModal = readFileSync("components/CreateChallengeModal.tsx", "utf8");
const routeTemplate = readFileSync("app/template.tsx", "utf8");
const routeTransition = readFileSync(
  "components/motion/PageTransition.tsx",
  "utf8",
);
const globalStyles = readFileSync("app/globals.css", "utf8");

describe("waiting motion system", () => {
  it("ships all four original arena scenes", () => {
    for (const scene of [
      "ArenaSpinner",
      "FiveStones",
      "MarbleKnock",
      "YoyoPulse",
    ]) {
      assert.match(source, new RegExp(`function ${scene}`));
    }
  });

  it("rotates at a calm interval and respects reduced motion", () => {
    assert.match(source, /6000/);
    assert.match(source, /prefers-reduced-motion: reduce/);
  });

  it("does not rely on heavy or branded animation assets", () => {
    assert.doesNotMatch(source, /\.(gif|webm|mp4)|lottie|pokemon|beyblade/i);
  });

  it("covers challenge and live-match route loading", () => {
    assert.match(challengeLoading, /ArenaRouteLoading/);
    assert.match(matchLoading, /ArenaRouteLoading/);
  });

  it("covers the on-chain challenge creation wait", () => {
    assert.match(challengeModal, /WaitingMotion compact label=\{LABELS\[phase\]\}/);
  });

  it("plays the original pixel fleet between every route", () => {
    assert.match(routeTemplate, /PageTransition/);
    assert.match(routeTransition, /skillfi-pixel-fleet\.png/);
    assert.match(globalStyles, /route-fleet-jump/);
    assert.match(globalStyles, /prefers-reduced-motion: reduce/);
  });
});
