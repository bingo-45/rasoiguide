import { zodToJsonSchema } from "zod-to-json-schema";

import { ContentPackSchema, RecipeSchema } from "./schema";

export const contentPackJsonSchema = zodToJsonSchema(ContentPackSchema, {
  name: "RasoiGuideContentPack",
  $refStrategy: "root"
});

export const recipeJsonSchema = zodToJsonSchema(RecipeSchema, {
  name: "RasoiGuideRecipe",
  $refStrategy: "root"
});
