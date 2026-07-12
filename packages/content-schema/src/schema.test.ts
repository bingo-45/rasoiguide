import { describe, expect, it } from "vitest";

import dalTadkaPack from "../../../content/packs/2.0.0/dal-tadka.json";
import {
  ContentPackSchema,
  contentPackJsonSchema,
  parseContentPack
} from "./index";

function clonePack(): unknown {
  return structuredClone(dalTadkaPack);
}

describe("content schema", () => {
  it("accepts the canonical bilingual Dal Tadka pack", () => {
    const parsed = parseContentPack(dalTadkaPack);

    expect(parsed.schemaVersion).toBe("2.0.0");
    expect(parsed.recipes[0]?.slug).toBe("dal-tadka");
    expect(parsed.recipes[0]?.steps.some((step) => step.whistles)).toBe(true);
  });

  it("exports JSON Schema for CDN and authoring validation", () => {
    expect(contentPackJsonSchema).toMatchObject({
      $schema: "http://json-schema.org/draft-07/schema#"
    });
  });

  it("rejects missing Hindi copy", () => {
    const pack = clonePack() as {
      recipes: Array<{ title: { en: string; hi?: string } }>;
    };
    delete pack.recipes[0]?.title.hi;

    expect(ContentPackSchema.safeParse(pack).success).toBe(false);
  });

  it("rejects a high-risk step without a check-in interval", () => {
    const pack = clonePack() as {
      recipes: Array<{
        steps: Array<{ risk: string; checkInIntervalSec?: number }>;
      }>;
    };
    const riskyStep = pack.recipes[0]?.steps.find(
      (step) => step.risk === "high"
    );
    if (riskyStep) delete riskyStep.checkInIntervalSec;

    expect(ContentPackSchema.safeParse(pack).success).toBe(false);
  });

  it("rejects whistle metadata without manual fallback", () => {
    const pack = clonePack() as {
      recipes: Array<{
        steps: Array<{
          whistles?: { manualFallback?: unknown };
        }>;
      }>;
    };
    const whistleStep = pack.recipes[0]?.steps.find(
      (step) => step.whistles !== undefined
    );
    if (whistleStep?.whistles) delete whistleStep.whistles.manualFallback;

    expect(ContentPackSchema.safeParse(pack).success).toBe(false);
  });

  it("rejects unknown or forward step dependencies", () => {
    const pack = clonePack() as {
      recipes: Array<{ steps: Array<{ dependsOn: string[] }> }>;
    };
    const secondStep = pack.recipes[0]?.steps[1];
    if (secondStep) secondStep.dependsOn = ["not-a-real-step"];

    expect(ContentPackSchema.safeParse(pack).success).toBe(false);
  });
});
