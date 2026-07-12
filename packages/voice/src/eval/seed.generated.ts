import { applyTemplate, EVAL_BASES, EVAL_TEMPLATES } from "../intents/corpus.js";
import { INTENTS, type Intent, type VoiceLocale } from "../intents/types.js";
import { VOICE_LOCALES } from "../intents/exemplars.js";

export interface IntentEvalCase {
  id: string;
  text: string;
  locale: VoiceLocale;
  expected: Intent | null;
  kind: "positive" | "adversarial";
}

export const EXPECTED_POSITIVE_EVAL_COUNT = 825;

export function generatePositiveSeedEvalSet(): IntentEvalCase[] {
  const cases: IntentEvalCase[] = [];
  for (const intent of INTENTS) {
    for (const locale of VOICE_LOCALES) {
      const phrases = EVAL_BASES[intent][locale];
      const templates = EVAL_TEMPLATES[locale];
      for (const [phraseIndex, phrase] of phrases.entries()) {
        for (const [templateIndex, template] of templates.entries()) {
          cases.push({
            id: `${intent}:${locale}:${phraseIndex + 1}:${templateIndex + 1}`,
            text: applyTemplate(template, phrase),
            locale,
            expected: intent,
            kind: "positive"
          });
        }
      }
    }
  }
  if (cases.length !== EXPECTED_POSITIVE_EVAL_COUNT) {
    throw new Error(`Seed intent corpus must contain ${EXPECTED_POSITIVE_EVAL_COUNT} positives; received ${cases.length}`);
  }
  return cases;
}

/** Near-misses are rejected rather than forced into an unsafe command. */
export const ADVERSARIAL_EVAL_SET: readonly IntentEvalCase[] = [
  { id: "adv:en:timer-set", text: "timer how long should I set", locale: "en", expected: null, kind: "adversarial" },
  { id: "adv:hi:timer-set", text: "टाइमर कितने मिनट का लगाऊँ", locale: "hi", expected: null, kind: "adversarial" },
  { id: "adv:hinglish:timer-set", text: "timer kitna set karu", locale: "hinglish", expected: null, kind: "adversarial" },
  { id: "adv:en:next-item", text: "I bought the next ingredient yesterday", locale: "en", expected: null, kind: "adversarial" },
  { id: "adv:hi:next-item", text: "अगली सामग्री बाजार से आई है", locale: "hi", expected: null, kind: "adversarial" },
  { id: "adv:hinglish:next-item", text: "next ingredient fridge mein hai", locale: "hinglish", expected: null, kind: "adversarial" },
  { id: "adv:en:back-burner", text: "the back burner is hot", locale: "en", expected: null, kind: "adversarial" },
  { id: "adv:hi:back-burner", text: "पीछे वाला बर्नर गर्म है", locale: "hi", expected: null, kind: "adversarial" },
  { id: "adv:hinglish:back-burner", text: "back burner hot hai", locale: "hinglish", expected: null, kind: "adversarial" },
  { id: "adv:en:flame-color", text: "the flame color is blue", locale: "en", expected: null, kind: "adversarial" },
  { id: "adv:hi:flame-color", text: "आग का रंग नीला है", locale: "hi", expected: null, kind: "adversarial" },
  { id: "adv:hinglish:flame-color", text: "flame ka color blue hai", locale: "hinglish", expected: null, kind: "adversarial" },
  { id: "adv:en:sub-teacher", text: "my substitute teacher cooks", locale: "en", expected: null, kind: "adversarial" },
  { id: "adv:hi:school", text: "स्कूल में विकल्प वाला अध्यापक आया", locale: "hi", expected: null, kind: "adversarial" },
  { id: "adv:hinglish:sub-teacher", text: "substitute teacher aaj nahi hai", locale: "hinglish", expected: null, kind: "adversarial" },
  { id: "adv:en:whistle-song", text: "there was a whistle in that song", locale: "en", expected: null, kind: "adversarial" },
  { id: "adv:hi:whistle-song", text: "गाने में सीटी की आवाज़ थी", locale: "hi", expected: null, kind: "adversarial" },
  { id: "adv:hinglish:whistle-song", text: "song mein whistle sound tha", locale: "hinglish", expected: null, kind: "adversarial" }
];

export const SEED_INTENT_EVAL_SET: readonly IntentEvalCase[] = [
  ...generatePositiveSeedEvalSet(),
  ...ADVERSARIAL_EVAL_SET
];
