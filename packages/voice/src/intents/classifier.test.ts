import { describe, expect, it } from "vitest";
import { EXPECTED_POSITIVE_EVAL_COUNT, generatePositiveSeedEvalSet } from "../eval/seed.generated.js";
import { ExemplarIntentClassifier, createDefaultIntentClassifier } from "./classifier.js";
import { buildSpokenDisambiguation } from "./disambiguation.js";
import { DEFAULT_INTENT_EXEMPLARS, EXEMPLARS_PER_INTENT_PER_LOCALE } from "./exemplars.js";
import { INTENTS } from "./types.js";

describe("intent exemplar corpus", () => {
  it("ships at least 25 examples per intent and language", () => {
    for (const intent of INTENTS) {
      for (const locale of ["en", "hi", "hinglish"] as const) {
        const count = DEFAULT_INTENT_EXEMPLARS.filter((item) => item.intent === intent && item.locale === locale).length;
        expect(count).toBe(EXEMPLARS_PER_INTENT_PER_LOCALE);
      }
    }
  });

  it("generates the required 825 positive evaluation utterances", () => {
    expect(generatePositiveSeedEvalSet()).toHaveLength(EXPECTED_POSITIVE_EVAL_COUNT);
  });
});

describe("ExemplarIntentClassifier", () => {
  it.each([
    ["yeh wala step complete hai", "advance"],
    ["मुझे एक कदम पीछे ले चलो", "go-back"],
    ["current step dobara bolo", "repeat"],
    ["kitne chammach use karun", "quantity-query"],
    ["टाइमर में कितना बाकी है", "timer-query"],
    ["induction level kya rakhu", "flame-query"],
    ["lagta hai burn ho raha hai", "troubleshoot"],
    ["sab kuch rok do", "pause-everything"],
    ["dal par focus karo", "switch-dish"],
    ["ek seeti hui", "whistle-report"],
    ["iske badle kya use karun", "substitute-query"]
  ] as const)("resolves %s", async (transcript, expected) => {
    const result = await createDefaultIntentClassifier().classify(transcript);
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.intent).toBe(expected);
  });

  it("returns top-three disambiguation instead of silently dropping low confidence", async () => {
    const classifier = new ExemplarIntentClassifier({ threshold: 0.99 });
    const result = await classifier.classify("kitchen ki khidki khol do");
    expect(result.status).toBe("ambiguous");
    expect(result.candidates).toHaveLength(3);
    expect(buildSpokenDisambiguation(result.candidates, "hinglish")).toMatch(/^Matlab:/u);
  });

  it("extracts bilingual quantities alongside the resolved command", async () => {
    const result = await createDefaultIntentClassifier().classify("do seeti ho gayi");
    expect(result.numbers[0]?.value).toBe(2);
  });
});
