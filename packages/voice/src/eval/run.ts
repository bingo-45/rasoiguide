import { pathToFileURL } from "node:url";
import { createDefaultIntentClassifier, type ExemplarIntentClassifier } from "../intents/classifier.js";
import { INTENTS, type Intent } from "../intents/types.js";
import { SEED_INTENT_EVAL_SET, type IntentEvalCase } from "./seed.generated.js";

export interface IntentEvalMetrics {
  total: number;
  positiveTotal: number;
  correct: number;
  overallAccuracy: number;
  hinglishAccuracy: number;
  falseAdvanceRate: number;
  adversarialRejectRate: number;
  ambiguousCount: number;
  perIntent: Readonly<Record<Intent, { correct: number; total: number; accuracy: number }>>;
  failures: readonly { id: string; text: string; expected: Intent | null; actual: Intent | "ambiguous"; score: number }[];
  passed: boolean;
}

export async function runIntentEvaluation(
  classifier: ExemplarIntentClassifier = createDefaultIntentClassifier(),
  cases: readonly IntentEvalCase[] = SEED_INTENT_EVAL_SET
): Promise<IntentEvalMetrics> {
  const results = await classifier.classifyMany(cases.map((testCase) => testCase.text));
  const positiveCases = cases.filter((testCase) => testCase.expected !== null);
  let correct = 0;
  let hinglishCorrect = 0;
  let hinglishTotal = 0;
  let falseAdvances = 0;
  let falseAdvanceOpportunities = 0;
  let adversarialRejected = 0;
  let adversarialTotal = 0;
  let ambiguousCount = 0;
  const failures: IntentEvalMetrics["failures"][number][] = [];
  const perIntentMutable = Object.fromEntries(INTENTS.map((intent) => [intent, { correct: 0, total: 0, accuracy: 0 }])) as Record<Intent, { correct: number; total: number; accuracy: number }>;

  for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index];
    const result = results[index];
    if (!testCase || !result) continue;
    const actual = result.status === "resolved" ? result.intent : "ambiguous";
    const score = result.candidates[0]?.score ?? 0;
    if (result.status === "ambiguous") ambiguousCount += 1;

    if (testCase.expected === null) {
      adversarialTotal += 1;
      if (result.status === "ambiguous") adversarialRejected += 1;
    } else {
      const bucket = perIntentMutable[testCase.expected];
      bucket.total += 1;
      if (actual === testCase.expected) {
        correct += 1;
        bucket.correct += 1;
      } else {
        failures.push({ id: testCase.id, text: testCase.text, expected: testCase.expected, actual, score });
      }
      if (testCase.locale === "hinglish") {
        hinglishTotal += 1;
        if (actual === testCase.expected) hinglishCorrect += 1;
      }
    }

    if (testCase.expected !== "advance") {
      falseAdvanceOpportunities += 1;
      if (actual === "advance") falseAdvances += 1;
    }
  }

  for (const intent of INTENTS) {
    const bucket = perIntentMutable[intent];
    bucket.accuracy = bucket.total === 0 ? 0 : bucket.correct / bucket.total;
  }

  const overallAccuracy = positiveCases.length === 0 ? 0 : correct / positiveCases.length;
  const hinglishAccuracy = hinglishTotal === 0 ? 0 : hinglishCorrect / hinglishTotal;
  const falseAdvanceRate = falseAdvanceOpportunities === 0 ? 0 : falseAdvances / falseAdvanceOpportunities;
  const adversarialRejectRate = adversarialTotal === 0 ? 1 : adversarialRejected / adversarialTotal;
  return {
    total: cases.length,
    positiveTotal: positiveCases.length,
    correct,
    overallAccuracy,
    hinglishAccuracy,
    falseAdvanceRate,
    adversarialRejectRate,
    ambiguousCount,
    perIntent: perIntentMutable,
    failures: failures.slice(0, 40),
    passed: overallAccuracy >= 0.9 && hinglishAccuracy >= 0.85 && falseAdvanceRate <= 0.01
  };
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatIntentEvalReport(metrics: IntentEvalMetrics): string {
  const rows = INTENTS.map((intent) => {
    const result = metrics.perIntent[intent];
    return `  ${intent.padEnd(18)} ${String(result.correct).padStart(3)}/${String(result.total).padEnd(3)} ${percentage(result.accuracy)}`;
  });
  const failures = metrics.failures.length === 0
    ? ["  none"]
    : metrics.failures.slice(0, 10).map((failure) => `  ${failure.id}: expected ${failure.expected}, got ${failure.actual} (${failure.score.toFixed(3)}) — ${failure.text}`);

  return [
    "RasoiGuide intent evaluation",
    `Cases: ${metrics.total} (${metrics.positiveTotal} positive)`,
    `Overall accuracy: ${percentage(metrics.overallAccuracy)} (gate >= 90%)`,
    `Hinglish accuracy: ${percentage(metrics.hinglishAccuracy)} (gate >= 85%)`,
    `False-advance rate: ${percentage(metrics.falseAdvanceRate)} (gate <= 1%)`,
    `Adversarial reject rate: ${percentage(metrics.adversarialRejectRate)} (diagnostic)`,
    `Ambiguous: ${metrics.ambiguousCount}`,
    "Per-intent:",
    ...rows,
    "First failures:",
    ...failures,
    `Gate: ${metrics.passed ? "PASS" : "FAIL"}`
  ].join("\n");
}

async function main(): Promise<void> {
  const metrics = await runIntentEvaluation();
  console.log(formatIntentEvalReport(metrics));
  if (!metrics.passed) process.exitCode = 1;
}

const directEntry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === directEntry) {
  void main();
}
