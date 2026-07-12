// The voice guide's understanding layer: free-form problem matching against
// authored recovery fixes, ingredient lookups for quantity questions, and
// small keyword routers for things the intent classifier does not cover.
// Everything works on-device over the recipe data — no services involved.

import type { CookingStep, Ingredient, Language, Recovery, RecipeCard } from "./model";
import { householdMeasure } from "./utils";

const STOPWORDS = new Set([
  "the", "is", "a", "an", "my", "me", "i", "it", "this", "that", "to", "of", "in", "on", "so", "very",
  "hai", "hain", "ho", "gaya", "gayi", "raha", "rahi", "mera", "meri", "kya", "kuch", "bahut", "thoda",
  "है", "हैं", "हो", "गया", "गयी", "गई", "रहा", "रही", "मेरा", "मेरी", "क्या", "कुछ", "बहुत", "थोड़ा",
  "yeh", "ye", "yah", "woh", "wo", "यह", "वह", "aur", "और", "please", "zara", "ज़रा", "toh", "तो"
]);

export const tokenize = (text: string): string[] =>
  text
    .toLocaleLowerCase("hi-IN")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));

/** Words that strongly signal "something went wrong with the food". */
const PROBLEM_PATTERN = /jal|burn|black|kaal|काल|जल|patl|पतल|water|गाढ़|gaadh|thick|फट|split|curdl|kadw|कड़व|bitter|salt|namak|नमक|खट्ट|khatt|sour|chipak|चिपक|stick|toot|टूट|break|dhu|धु|smoke|leak|लीक|सीटी|seeti|whistle|gadbad|गड़बड़|kharab|ख़राब|खराब|problem|wrong|help|madad|मदद|galat|गलत|mushy|slimy|lace|लेस/i;

export const soundsLikeProblem = (transcript: string): boolean => PROBLEM_PATTERN.test(transcript);

export const wantsHelp = (transcript: string): boolean =>
  /(^|\s)(help|madad|मदद|guide|kya bol|kya kah|what can|commands?)(\s|$)/i.test(transcript);

export const wantsTimerStart = (transcript: string): boolean =>
  /(timer|टाइमर).{0,12}(shuru|start|laga|chalu|चालू|लगा|शुरू)|start.{0,8}timer/i.test(transcript);

export const wantsResume = (transcript: string): boolean =>
  /(chalu|chaalu|resume|shuru|चालू|शुरू|wapas|वापस)/i.test(transcript);

interface RecoveryMatch {
  recovery: Recovery;
  step: CookingStep;
  score: number;
}

const recoveryTokens = (recovery: Recovery): Set<string> => {
  const bag = new Set<string>();
  for (const lang of ["en", "hi", "hi-Latn"] as const) {
    for (const token of tokenize(recovery.failure[lang])) bag.add(token);
  }
  return bag;
};

/**
 * Find the authored recovery whose failure description best matches what the
 * cook just said. The current step's recoveries win ties (that is where the
 * trouble almost always is).
 */
export function matchRecovery(recipe: RecipeCard, stepIndex: number, transcript: string): RecoveryMatch | undefined {
  const spoken = new Set(tokenize(transcript));
  if (spoken.size === 0) return undefined;
  let best: RecoveryMatch | undefined;
  recipe.steps.forEach((step, index) => {
    for (const recovery of step.recovery) {
      let score = 0;
      for (const token of recoveryTokens(recovery)) {
        if (spoken.has(token)) score += 2;
        else {
          // Prefix match ties Hinglish variants together (patli/patla, jal/jala).
          for (const said of spoken) {
            if (said.length > 3 && (token.startsWith(said) || said.startsWith(token))) { score += 1; break; }
          }
        }
      }
      if (score === 0) continue;
      if (index === stepIndex) score += 2;
      if (!best || score > best.score) best = { recovery, step, score };
    }
  });
  return best && best.score >= 3 ? best : undefined;
}

/** Match an ingredient mentioned in the transcript (any language). */
export function matchIngredient(recipe: RecipeCard, transcript: string): Ingredient | undefined {
  const spoken = new Set(tokenize(transcript));
  let best: { ingredient: Ingredient; score: number } | undefined;
  for (const ingredient of recipe.ingredients) {
    let score = 0;
    for (const lang of ["en", "hi", "hi-Latn"] as const) {
      for (const token of tokenize(ingredient.name[lang])) {
        if (spoken.has(token)) score += 2;
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { ingredient, score };
  }
  return best?.ingredient;
}

/** Spoken quantity answer for one ingredient, in the cook's language. */
export function quantityAnswer(ingredient: Ingredient, servings: number, baseServings: number, katoriMl: number, language: Language): string {
  const { canonical, andaaz } = householdMeasure(ingredient, servings, baseServings, katoriMl);
  const name = ingredient.name[language] || ingredient.name.en;
  const prep = ingredient.prep[language] || ingredient.prep.en;
  if (language === "hi") return `${name} — ${canonical}, यानी लगभग ${andaaz}। ${prep}।`;
  return `${name} — ${canonical}, yaani lagbhag ${andaaz}. ${prep}.`;
}

/** Spoken summary of the three main ingredients when none was named. */
export function quantitySummary(recipe: RecipeCard, servings: number, katoriMl: number, language: Language): string {
  return recipe.ingredients
    .slice(0, 3)
    .map((ingredient) => {
      const { canonical } = householdMeasure(ingredient, servings, recipe.servingsBase, katoriMl);
      return `${ingredient.name[language] || ingredient.name.en} ${canonical}`;
    })
    .join(language === "hi" ? ", " : ", ");
}
