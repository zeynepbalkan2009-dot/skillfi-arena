export const PASSAGES = [
  "Skill creates an edge when practice becomes measurable and consistent.",
  "Fast hands are useful, but accuracy and composure win difficult matches.",
  "Every round is a test of focus, rhythm, precision, and recovery.",
  "Competitive players improve faster when every result becomes useful data.",
  "Small improvements compound when the same challenge is repeated with intent.",
] as const;

export function passageForMatch(matchId: string): string {
  let hash = 2166136261;
  for (const char of matchId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return PASSAGES[Math.abs(hash) % PASSAGES.length];
}

export function scoreTyping(passage: string, typedText: string, elapsedMs: number) {
  const safeElapsed = Math.max(1000, Math.min(elapsedMs, 120000));
  const typedChars = typedText.length;
  let correctChars = 0;
  for (let i = 0; i < typedChars; i++) if (typedText[i] === passage[i]) correctChars++;
  const accuracy = typedChars === 0 ? 0 : correctChars / typedChars;
  const wpm = (correctChars / 5) / (safeElapsed / 60000);
  return { typedChars, correctChars, accuracy, wpm, elapsedMs: safeElapsed };
}
