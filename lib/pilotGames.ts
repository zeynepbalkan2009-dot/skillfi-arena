export const PILOT_GAMES = [
  { id: "typing-sprint", name: "Typing Sprint", skill: "Speed and accuracy", instructions: "Copy the passage exactly." },
  { id: "arithmetic-rush", name: "Arithmetic Rush", skill: "Mental arithmetic", instructions: "Solve the five expressions. Separate answers with commas." },
  { id: "sequence-recall", name: "Sequence Recall", skill: "Working memory", instructions: "Re-enter the displayed digit sequence without spaces." },
  { id: "pattern-lock", name: "Pattern Lock", skill: "Pattern recognition", instructions: "Find the next five values. Separate answers with commas." },
  { id: "logic-grid", name: "Logic Grid", skill: "Deductive reasoning", instructions: "Answer the five statements with T or F, separated by commas." },
] as const;

export type PilotGameId = (typeof PILOT_GAMES)[number]["id"];
export type PilotRound = { prompt: string; expected: string; maxScore: number };

function seededNumber(seed: string) {
  let value = 2166136261;
  for (const char of seed) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return Math.abs(value);
}

export function createPilotRound(gameId: PilotGameId, seed: string): PilotRound {
  const n = seededNumber(`${gameId}:${seed}`);
  if (gameId === "typing-sprint") {
    const passages = [
      "Calm focus and precise decisions create a lasting competitive edge.",
      "Strong players improve by measuring each attempt and learning quickly.",
      "Accuracy under pressure turns deliberate practice into reliable skill.",
    ];
    const prompt = passages[n % passages.length];
    return { prompt, expected: prompt, maxScore: prompt.replace(/\s+/g, "").length };
  }
  if (gameId === "arithmetic-rush") {
    const pairs = Array.from({ length: 5 }, (_, index) => ({ a: 8 + ((n >> index) % 41), b: 3 + ((n >> (index + 3)) % 17) }));
    return { prompt: pairs.map(({ a, b }, i) => `${i + 1}) ${a} + ${b}`).join("   "), expected: pairs.map(({ a, b }) => a + b).join(","), maxScore: 5 };
  }
  if (gameId === "sequence-recall") {
    const expected = String(n).padStart(10, "7").slice(0, 10);
    return { prompt: expected.split("").join("  "), expected, maxScore: 10 };
  }
  if (gameId === "pattern-lock") {
    const start = 2 + (n % 8); const step = 2 + (n % 5);
    const shown = Array.from({ length: 5 }, (_, i) => start + i * step);
    const answers = Array.from({ length: 5 }, (_, i) => start + (i + 5) * step);
    return { prompt: `${shown.join(", ")}, …`, expected: answers.join(","), maxScore: 5 };
  }
  const statements = ["2 < 7", "9 is even", "5 + 4 = 9", "12 / 3 = 5", "3 × 3 > 8"];
  return { prompt: statements.map((item, i) => `${i + 1}) ${item}`).join("   "), expected: "T,F,T,F,T", maxScore: 5 };
}

export function scorePilotRound(round: PilotRound, answer: string) {
  const normalize = (value: string) => value.toUpperCase().replace(/\s+/g, "");
  const expected = normalize(round.expected);
  const actual = normalize(answer);
  if (round.maxScore <= 5) {
    const expectedParts = expected.split(","); const actualParts = actual.split(",");
    const points = expectedParts.reduce((total, part, index) => total + Number(actualParts[index] === part), 0);
    return { points, maxScore: round.maxScore, percent: Math.round((points / round.maxScore) * 100) };
  }
  const points = [...expected].reduce((total, char, index) => total + Number(actual[index] === char), 0);
  return { points, maxScore: round.maxScore, percent: Math.round((points / round.maxScore) * 100) };
}
