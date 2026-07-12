import {
  parseContentPack,
  type ContentPack,
  type Recipe
} from "@rasoiguide/content-schema";

import dalTadkaSource from "./dal-tadka.json";

export const dalTadkaPack: ContentPack = parseContentPack(dalTadkaSource);

export const dalTadkaRecipe: Recipe = dalTadkaPack.recipes[0] as Recipe;
