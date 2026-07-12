import { describe, expect, it } from "vitest";
import { SEED_INTENT_EVAL_SET } from "./seed.generated.js";
import { runIntentEvaluation } from "./run.js";

describe("intent evaluation gate", () => {
  it("meets accuracy, Hinglish, and false-advance thresholds", async () => {
    const metrics = await runIntentEvaluation();
    expect(SEED_INTENT_EVAL_SET.length).toBeGreaterThanOrEqual(825);
    expect(metrics.overallAccuracy).toBeGreaterThanOrEqual(0.9);
    expect(metrics.hinglishAccuracy).toBeGreaterThanOrEqual(0.85);
    expect(metrics.falseAdvanceRate).toBeLessThanOrEqual(0.01);
    expect(metrics.passed).toBe(true);
  }, 30_000);
});
