const FILLERS = new Set([
  "um",
  "umm",
  "uh",
  "er",
  "like",
  "toh",
  "matlab",
  "मतलब",
  "तो"
]);

const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9"
};

/** Keeps both scripts intact while removing recognition noise and bilingual fillers. */
export function normalizeTranscript(transcript: string): string {
  const digitNormalized = [...transcript.normalize("NFKC").toLocaleLowerCase("hi-IN")]
    .map((character) => DEVANAGARI_DIGITS[character] ?? character)
    .join("");

  return digitNormalized
    .replace(/[^\p{L}\p{M}\p{N}.]+/gu, " ")
    .split(/\s+/u)
    .filter((token) => token.length > 0 && !FILLERS.has(token))
    .join(" ")
    .trim();
}
