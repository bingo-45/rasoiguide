import { z } from "zod";

export const CONTENT_SCHEMA_VERSION = "2.0.0" as const;

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const assetPathPattern = /^\/assets\/[a-zA-Z0-9_./-]+$/;

export const BilingualTextSchema = z
  .object({
    en: z.string().trim().min(1),
    hi: z.string().trim().min(1)
  })
  .strict();

export const AssetReferenceSchema = z
  .object({
    src: z.string().regex(assetPathPattern, "Asset paths must begin with /assets/"),
    alt: BilingualTextSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive()
  })
  .strict();

export const MeasurementUnitSchema = z.enum([
  "g",
  "ml",
  "piece",
  "pinch"
]);

export const CanonicalQuantitySchema = z
  .object({
    qty: z.number().positive(),
    unit: MeasurementUnitSchema
  })
  .strict();

const LinearScalingSchema = z
  .object({
    kind: z.literal("linear"),
    ingredientClass: z.enum(["salt", "fat", "acid", "garnish", "other"]),
    exponent: z.literal(1)
  })
  .strict();

const PowerScalingSchema = z
  .object({
    kind: z.literal("power"),
    ingredientClass: z.enum(["green-chilli", "whole-spice", "ground-spice"]),
    exponent: z.number().positive().max(1)
  })
  .strict();

const AbsorptionScalingSchema = z
  .object({
    kind: z.literal("absorption-table"),
    ingredientClass: z.literal("water"),
    points: z
      .array(
        z
          .object({
            servings: z.number().int().positive(),
            multiplier: z.number().positive()
          })
          .strict()
      )
      .min(2)
  })
  .strict()
  .superRefine((curve, ctx) => {
    for (let index = 1; index < curve.points.length; index += 1) {
      const previous = curve.points[index - 1];
      const current = curve.points[index];
      if (previous && current && current.servings <= previous.servings) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["points", index, "servings"],
          message: "Absorption-table servings must be strictly increasing"
        });
      }
    }
  });

export const ScalingCurveSchema = z.union([
  LinearScalingSchema,
  PowerScalingSchema,
  AbsorptionScalingSchema
]);

const StepPatchFieldsSchema = z
  .object({
    stepId: z.string().regex(idPattern),
    text: BilingualTextSchema.optional(),
    spoken: BilingualTextSchema.optional(),
    durationSec: z.number().int().positive().optional(),
    flameLevel: z.number().int().min(1).max(5).optional(),
    dependsOn: z.array(z.string().regex(idPattern)).optional(),
    note: BilingualTextSchema
  })
  .strict();

function changesStep(
  patch: Omit<z.infer<typeof StepPatchFieldsSchema>, "stepId" | "note">
): boolean {
  return (
    patch.text !== undefined ||
    patch.spoken !== undefined ||
    patch.durationSec !== undefined ||
    patch.flameLevel !== undefined ||
    patch.dependsOn !== undefined
  );
}

export const StepPatchSchema = StepPatchFieldsSchema
  .refine(
    (patch) => changesStep(patch),
    { message: "A step patch must change at least one step field" }
  );

const VariantStepPatchSchema = StepPatchFieldsSchema.omit({ stepId: true }).refine(
  (patch) => changesStep(patch),
  { message: "A step patch must change at least one step field" }
);

export const SubstitutionSchema = z
  .object({
    substitute: z
      .object({
        id: z.string().regex(idPattern),
        name: BilingualTextSchema
      })
      .strict(),
    ratio: z
      .object({
        sourceQty: z.number().positive(),
        substituteQty: z.number().positive(),
        substituteUnit: MeasurementUnitSchema
      })
      .strict(),
    flavorNote: BilingualTextSchema,
    stepPatch: StepPatchSchema.optional()
  })
  .strict();

export const IngredientSchema = z
  .object({
    id: z.string().regex(idPattern),
    name: BilingualTextSchema,
    canonical: CanonicalQuantitySchema,
    prepState: BilingualTextSchema,
    scalingCurve: ScalingCurveSchema,
    substitutions: z.array(SubstitutionSchema)
  })
  .strict();

export const CookwareNotesSchema = z
  .object({
    kadhai: BilingualTextSchema.optional(),
    nonstick: BilingualTextSchema.optional(),
    cooker: BilingualTextSchema.optional()
  })
  .strict()
  .refine((notes) => Object.keys(notes).length > 0, {
    message: "Cookware notes must contain at least one cookware-specific note"
  });

export const DonenessSchema = z
  .object({
    cues: z.array(BilingualTextSchema).min(1),
    clipEmbeddingRef: z.string().regex(assetPathPattern).optional()
  })
  .strict();

export const RecoverySchema = z
  .object({
    id: z.string().regex(idPattern),
    failure: BilingualTextSchema,
    clarify: BilingualTextSchema.optional(),
    fix: z
      .object({
        spoken: BilingualTextSchema,
        written: BilingualTextSchema,
        stepPatch: StepPatchSchema.optional()
      })
      .strict(),
    photoPair: z
      .object({
        recoverable: z.string().regex(assetPathPattern),
        adjustRecipe: z.string().regex(assetPathPattern)
      })
      .strict()
      .optional()
  })
  .strict();

export const WhistleManualFallbackSchema = z
  .object({
    tapLabel: BilingualTextSchema,
    voiceExamples: z
      .object({
        en: z.array(z.string().trim().min(1)).min(1),
        hi: z.array(z.string().trim().min(1)).min(1),
        hinglish: z.array(z.string().trim().min(1)).min(1)
      })
      .strict()
  })
  .strict();

export const WhistleSpecSchema = z
  .object({
    count: z.number().int().positive(),
    thenFlame: z.number().int().min(1).max(5).optional(),
    thenDurationSec: z.number().int().positive().optional(),
    calibrationPrompt: BilingualTextSchema,
    manualFallback: WhistleManualFallbackSchema,
    onTarget: z.literal("advance-and-speak")
  })
  .strict();

export const StepSchema = z
  .object({
    id: z.string().regex(idPattern),
    n: z.number().int().positive(),
    dependsOn: z.array(z.string().regex(idPattern)),
    text: BilingualTextSchema,
    spoken: BilingualTextSchema,
    durationSec: z.number().int().positive().optional(),
    attention: z.enum(["active", "passive"]),
    risk: z.enum(["normal", "high"]),
    flameLevel: z.number().int().min(1).max(5),
    cookwareNotes: CookwareNotesSchema.optional(),
    whistles: WhistleSpecSchema.optional(),
    refPhoto: z.string().regex(assetPathPattern),
    doneness: DonenessSchema,
    recoveryTree: z.array(RecoverySchema).min(1),
    checkInIntervalSec: z.number().int().positive().optional()
  })
  .strict()
  .superRefine((step, ctx) => {
    if (step.risk === "high" && step.checkInIntervalSec === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkInIntervalSec"],
        message: "High-risk steps require a proactive check-in interval"
      });
    }

    if (step.text.en === step.spoken.en || step.text.hi === step.spoken.hi) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["spoken"],
        message: "Spoken copy must be authored separately from written copy"
      });
    }
  });

const IngredientPatchSchema = z
  .object({
    name: BilingualTextSchema.optional(),
    canonical: CanonicalQuantitySchema.optional(),
    prepState: BilingualTextSchema.optional(),
    scalingCurve: ScalingCurveSchema.optional()
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "An ingredient patch must change at least one field"
  });

export const VariantPatchOperationSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("remove-ingredient"),
      ingredientId: z.string().regex(idPattern),
      reason: BilingualTextSchema
    })
    .strict(),
  z
    .object({
      op: z.literal("add-ingredient"),
      afterIngredientId: z.string().regex(idPattern).optional(),
      ingredient: IngredientSchema,
      reason: BilingualTextSchema
    })
    .strict(),
  z
    .object({
      op: z.literal("patch-ingredient"),
      ingredientId: z.string().regex(idPattern),
      patch: IngredientPatchSchema,
      reason: BilingualTextSchema
    })
    .strict(),
  z
    .object({
      op: z.literal("remove-step"),
      stepId: z.string().regex(idPattern),
      reason: BilingualTextSchema
    })
    .strict(),
  z
    .object({
      op: z.literal("patch-step"),
      stepId: z.string().regex(idPattern),
      patch: VariantStepPatchSchema,
      reason: BilingualTextSchema
    })
    .strict()
]);

export const RecipeVariantSchema = z
  .object({
    tag: z.enum(["satvik", "jain", "vrat"]),
    title: BilingualTextSchema,
    patchOps: z.array(VariantPatchOperationSchema).min(1)
  })
  .strict();

export const PhotographyManifestSchema = z
  .object({
    stockPhotographyAllowed: z.literal(false),
    shootStatus: z.enum(["planned", "in-progress", "approved"]),
    consistencyGuide: z
      .object({
        angle: BilingualTextSchema,
        vessel: BilingualTextSchema,
        light: BilingualTextSchema,
        background: BilingualTextSchema
      })
      .strict(),
    hero: AssetReferenceSchema,
    stages: z
      .array(
        z
          .object({
            stepId: z.string().regex(idPattern),
            image: AssetReferenceSchema,
            status: z.enum(["planned", "shot", "approved"]),
            cue: BilingualTextSchema
          })
          .strict()
      )
      .min(1)
  })
  .strict();

export const RecipeTagSchema = z.enum([
  "satvik",
  "jain",
  "vrat",
  "festival",
  "everyday",
  "guests",
  "vegetarian",
  "north-indian",
  "protein-rich",
  "comfort-food"
]);

export const RecipeSchema = z
  .object({
    id: z.string().regex(idPattern),
    slug: z.string().regex(idPattern),
    region: BilingualTextSchema,
    course: BilingualTextSchema,
    servingsBase: z.number().int().positive(),
    estimatedDurationSec: z.number().int().positive(),
    difficulty: z.enum(["easy", "medium", "advanced"]),
    title: BilingualTextSchema,
    headnote: BilingualTextSchema,
    tags: z.array(RecipeTagSchema).min(1),
    variants: z.array(RecipeVariantSchema),
    ingredients: z.array(IngredientSchema).min(1),
    steps: z.array(StepSchema).min(1),
    photographyManifest: PhotographyManifestSchema
  })
  .strict()
  .superRefine((recipe, ctx) => {
    const ingredientIds = new Set<string>();
    recipe.ingredients.forEach((ingredient, index) => {
      if (ingredientIds.has(ingredient.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ingredients", index, "id"],
          message: `Duplicate ingredient id: ${ingredient.id}`
        });
      }
      ingredientIds.add(ingredient.id);
    });

    const stepIds = new Set<string>();
    recipe.steps.forEach((step, index) => {
      if (stepIds.has(step.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "id"],
          message: `Duplicate step id: ${step.id}`
        });
      }
      stepIds.add(step.id);
      if (step.n !== index + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "n"],
          message: "Step numbers must be contiguous and match array order"
        });
      }
    });

    recipe.steps.forEach((step, index) => {
      for (const dependency of step.dependsOn) {
        const dependencyIndex = recipe.steps.findIndex(
          (candidate) => candidate.id === dependency
        );
        if (dependencyIndex < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["steps", index, "dependsOn"],
            message: `Unknown step dependency: ${dependency}`
          });
        } else if (dependencyIndex >= index) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["steps", index, "dependsOn"],
            message: `Dependencies must refer to an earlier step: ${dependency}`
          });
        }
      }
    });

    const manifestStepIds = new Set(
      recipe.photographyManifest.stages.map((stage) => stage.stepId)
    );
    recipe.steps.forEach((step, index) => {
      if (!manifestStepIds.has(step.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["photographyManifest", "stages"],
          message: `Photography manifest is missing step ${step.id}`
        });
      }
      const manifestEntry = recipe.photographyManifest.stages.find(
        (stage) => stage.stepId === step.id
      );
      if (manifestEntry && manifestEntry.image.src !== step.refPhoto) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "refPhoto"],
          message: `Step photo must match the photography manifest for ${step.id}`
        });
      }
    });

    recipe.photographyManifest.stages.forEach((stage, index) => {
      if (!stepIds.has(stage.stepId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["photographyManifest", "stages", index, "stepId"],
          message: `Photography stage references unknown step ${stage.stepId}`
        });
      }
    });

    recipe.variants.forEach((variant, variantIndex) => {
      variant.patchOps.forEach((operation, operationIndex) => {
        if (
          "ingredientId" in operation &&
          !ingredientIds.has(operation.ingredientId)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["variants", variantIndex, "patchOps", operationIndex],
            message: `Variant references unknown ingredient ${operation.ingredientId}`
          });
        }
        if ("stepId" in operation && !stepIds.has(operation.stepId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["variants", variantIndex, "patchOps", operationIndex],
            message: `Variant references unknown step ${operation.stepId}`
          });
        }
      });
    });
  });

export const ContentPackSchema = z
  .object({
    schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
    packVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    id: z.string().regex(idPattern),
    generatedAt: z.string().datetime({ offset: true }),
    localeCoverage: z.tuple([z.literal("en"), z.literal("hi")]),
    recipes: z.array(RecipeSchema).min(1)
  })
  .strict()
  .superRefine((pack, ctx) => {
    const recipeIds = new Set<string>();
    pack.recipes.forEach((recipe, index) => {
      if (recipeIds.has(recipe.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recipes", index, "id"],
          message: `Duplicate recipe id: ${recipe.id}`
        });
      }
      recipeIds.add(recipe.id);
    });
  });

export type BilingualText = z.infer<typeof BilingualTextSchema>;
export type ScalingCurve = z.infer<typeof ScalingCurveSchema>;
export type StepPatch = z.infer<typeof StepPatchSchema>;
export type Substitution = z.infer<typeof SubstitutionSchema>;
export type Ingredient = z.infer<typeof IngredientSchema>;
export type Recovery = z.infer<typeof RecoverySchema>;
export type WhistleSpec = z.infer<typeof WhistleSpecSchema>;
export type Step = z.infer<typeof StepSchema>;
export type RecipeVariant = z.infer<typeof RecipeVariantSchema>;
export type PhotographyManifest = z.infer<typeof PhotographyManifestSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type ContentPack = z.infer<typeof ContentPackSchema>;

export function parseRecipe(input: unknown): Recipe {
  return RecipeSchema.parse(input);
}

export function parseContentPack(input: unknown): ContentPack {
  return ContentPackSchema.parse(input);
}
