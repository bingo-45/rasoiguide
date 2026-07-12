import { describe, expect, it } from "vitest";
import { recipes } from "./data/recipes";
import { answerCookingQuestion, detectGuideLanguage } from "./guide";

const recipe = recipes.find((item) => item.id === "dal-tadka")!;
const context = {
  recipe,
  stepIndex: 0,
  servings: recipe.servingsBase,
  katoriMl: 180,
  preferredLanguage: "en" as const,
  stove: "gas" as const
};

describe("grounded bilingual cooking guide", () => {
  it("mirrors English, Hindi and Hinglish utterances", () => {
    expect(detectGuideLanguage("How should this look?", "hi-Latn")).toBe("en");
    expect(detectGuideLanguage("यह कब तैयार होगा?", "en")).toBe("hi");
    expect(detectGuideLanguage("kaise pata chalega ready hai", "en")).toBe("hi-Latn");
  });

  it("answers doneness from the active step cue", () => {
    const answer = answerCookingQuestion("How do I know this is done?", context);
    expect(answer).toContain(recipe.steps[0]!.cue.en);
  });

  it("keeps Hinglish answers in Hinglish", () => {
    const answer = answerCookingQuestion("abhi kya karu", context);
    expect(answer).toContain(recipe.steps[0]!.spoken["hi-Latn"]);
  });

  it("returns a grounded next step", () => {
    const answer = answerCookingQuestion("What next?", context);
    expect(answer).toContain(recipe.steps[1]!.spoken.en);
  });
});
