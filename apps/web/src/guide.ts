// The voice guide's understanding layer: free-form problem matching against
// authored recovery fixes, ingredient lookups for quantity questions, and
// small keyword routers for things the intent classifier does not cover.
// Everything works on-device over the recipe data — no services involved.

import type { CookingStep, Ingredient, Language, LocalText, Recovery, RecipeCard } from "./model";
import { flameInstruction, householdMeasure } from "./utils";

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

export interface GuideContext {
  recipe: RecipeCard;
  stepIndex: number;
  servings: number;
  katoriMl: number;
  preferredLanguage: Language;
  stove: "gas" | "induction" | "coil";
}

/** Detect the language of this utterance so the guide mirrors the cook, even
 * when their saved preference is different. */
export function detectGuideLanguage(text: string, fallback: Language): Language {
  if (/\p{Script=Devanagari}/u.test(text)) return "hi";
  if (/\b(kya|kaise|kitna|kitni|kab|kyun|kyu|nahi|nahin|hai|hain|wala|wali|daalu|dalun|karu|karo|ho gaya|paani|namak|masala|aage|agla)\b/i.test(text)) return "hi-Latn";
  return /\b(what|how|when|why|can|should|is|are|do|next|ingredient|substitute|cook)\b/i.test(text) ? "en" : fallback;
}

const says = (language: Language, en: string, hi: string, hinglish: string): string =>
  language === "hi" ? hi : language === "hi-Latn" ? hinglish : en;
const guideText = (value: LocalText, language: Language): string => value[language] || value.en;

/**
 * A grounded, offline cooking answer engine. It only answers from the active
 * recipe and step, so a weak connection never turns the guide into a guessing
 * chatbot. Navigation remains in the voice controller; open questions land here.
 */
export function answerCookingQuestion(transcript: string, context: GuideContext): string {
  const { recipe, stepIndex, servings, katoriMl, stove } = context;
  const step = recipe.steps[stepIndex]!;
  const language = detectGuideLanguage(transcript, context.preferredLanguage);
  const lower = transcript.toLocaleLowerCase("hi-IN");
  const ingredient = matchIngredient(recipe, transcript);

  if (soundsLikeProblem(transcript)) {
    const recovery = matchRecovery(recipe, stepIndex, transcript);
    return recovery
      ? `${says(language, "Do this now:", "अभी यह करें:", "Abhi yeh karo:")} ${guideText(recovery.recovery.fix, language)}`
      : says(language, `Tell me what you see: is it burnt, watery, too thick, split, or too salty? I’ll fix this step with you.`, `मुझे बताइए क्या दिख रहा है—जला, पतला, बहुत गाढ़ा, फटा या नमकीन? मैं इसी स्टेप में सुधार बताऊँगा।`, `Mujhe batao kya dikh raha hai—jala, patla, bahut gaadha, phata ya namkeen? Main isi step ka fix bataunga.`);
  }

  if (ingredient && /(kitn|कितन|how much|quantity|amount|measure|daal|डाल|add)/i.test(lower)) {
    return quantityAnswer(ingredient, servings, recipe.servingsBase, katoriMl, language);
  }

  if (ingredient && /(replace|substitut|instead|badle|बदले|nahi hai|नहीं है|skip)/i.test(lower)) {
    const substitution = ingredient.substitutions?.[0];
    return substitution
      ? `${guideText(ingredient.name, language)} ${says(language, "can be replaced with", "की जगह", "ki jagah")} ${guideText(substitution.name, language)} (${substitution.ratio}). ${guideText(substitution.note, language)}`
      : says(language, `This recipe has no tested substitute for ${ingredient.name.en}. Keep it out only if it is optional; otherwise the result may change.`, `${guideText(ingredient.name, language)} का जाँचा हुआ विकल्प इस रेसिपी में नहीं है। यह वैकल्पिक हो तभी छोड़ें।`, `${guideText(ingredient.name, language)} ka tested substitute is recipe mein nahi hai. Optional ho tabhi chhodo.`);
  }

  if (/(next|aage|agla|आगे|अगला|after this|phir|फिर)/i.test(lower)) {
    const next = recipe.steps[stepIndex + 1];
    return next
      ? `${says(language, "Next:", "अगला:", "Agla:")} ${guideText(next.spoken, language)} ${says(language, "Look for:", "यह निशानी देखें:", "Yeh nishani dekho:")} ${guideText(next.cue, language)}`
      : says(language, "This is the final step. Finish when the look and texture match the cue on screen.", "यह आख़िरी स्टेप है। स्क्रीन पर दी निशानी से रंग और बनावट मिलें तो पूरा करें।", "Yeh aakhri step hai. Screen wali nishani se rang aur texture mile to finish karo.");
  }

  if (/(how.*look|what.*look|ready|done|doneness|pehchan|kaise pata|कैसे पता|दिख|rang|रंग|texture|बनावट)/i.test(lower)) {
    return `${says(language, "You’re ready to move on when:", "अगले स्टेप पर जाएँ जब:", "Aage tab jao jab:")} ${guideText(step.cue, language)}`;
  }

  if (/(why|kyun|kyu|क्यों)/i.test(lower)) {
    return says(language,
      `This step builds the right colour, aroma and texture before you move on. Follow the visual cue—not only the clock: ${step.cue.en}`,
      `यह स्टेप सही रंग, खुशबू और बनावट बनाता है। केवल समय नहीं, यह निशानी देखें: ${step.cue.hi}`,
      `Yeh step sahi rang, khushboo aur texture banata hai. Sirf clock nahi, yeh cue dekho: ${step.cue["hi-Latn"]}`);
  }

  if (/(time|timer|minute|kitni der|kitna time|कितनी देर|कितना समय)/i.test(lower)) {
    return step.durationSec
      ? says(language, `About ${Math.ceil(step.durationSec / 60)} minutes, but use this visual cue: ${step.cue.en}`, `लगभग ${Math.ceil(step.durationSec / 60)} मिनट, पर यह निशानी ज़रूर देखें: ${step.cue.hi}`, `Lagbhag ${Math.ceil(step.durationSec / 60)} minute, par yeh cue zaroor dekho: ${step.cue["hi-Latn"]}`)
      : says(language, `There is no fixed timer here. Move on when: ${step.cue.en}`, `यहाँ तय टाइमर नहीं है। आगे जाएँ जब: ${step.cue.hi}`, `Yahan fixed timer nahi hai. Aage tab jao jab: ${step.cue["hi-Latn"]}`);
  }

  if (/(flame|heat|gas|aanch|आंच|induction|temperature)/i.test(lower)) {
    return `${says(language, "Heat:", "आंच:", "Aanch:")} ${flameInstruction(stove, step.flame, language)}. ${says(language, "Current cue:", "अभी की निशानी:", "Abhi ka cue:")} ${guideText(step.cue, language)}`;
  }

  if (/(ingredient|saman|सामान|what do i need|kya chahiye|क्या चाहिए)/i.test(lower)) {
    return `${says(language, "For this dish, the main quantities are:", "इस डिश की मुख्य मात्राएँ:", "Is dish ki main quantities:")} ${quantitySummary(recipe, servings, katoriMl, language)}.`;
  }

  if (/(repeat|again|current|abhi|अभी|kya kar|क्या कर)/i.test(lower)) {
    return `${guideText(step.spoken, language)} ${says(language, "You’ll know it is right when:", "सही होने की निशानी:", "Sahi hone ki nishani:")} ${guideText(step.cue, language)}`;
  }

  return says(language,
    `I’m with you on step ${stepIndex + 1} of ${recipe.title.en}. Ask me about quantity, heat, timing, substitutions, what it should look like, or tell me exactly what went wrong. Right now: ${step.spoken.en}`,
    `मैं ${guideText(recipe.title, language)} के स्टेप ${stepIndex + 1} पर आपके साथ हूँ। मात्रा, आंच, समय, विकल्प, सही दिखावट पूछें या दिक्कत बताएं। अभी: ${step.spoken.hi}`,
    `Main ${guideText(recipe.title, language)} ke step ${stepIndex + 1} par aapke saath hoon. Quantity, aanch, time, substitute, look ya problem poochho. Abhi: ${step.spoken["hi-Latn"]}`);
}
