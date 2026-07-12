import { applyTemplate, EVAL_BASES, EXEMPLAR_BASES, TRAINING_TEMPLATES } from "./corpus.js";
import { INTENTS, type IntentExemplar, type VoiceLocale } from "./types.js";

export const VOICE_LOCALES = ["en", "hi", "hinglish"] as const satisfies readonly VoiceLocale[];
export const EXEMPLARS_PER_INTENT_PER_LOCALE = 50;

export function generateIntentExemplars(): IntentExemplar[] {
  const exemplars: IntentExemplar[] = [];

  for (const intent of INTENTS) {
    for (const locale of VOICE_LOCALES) {
      // Both authoring banks are exemplars. Evaluation applies unseen conversational
      // frames around these semantic anchors; no exact eval utterance is trained.
      const bases = [...EXEMPLAR_BASES[intent][locale], ...EVAL_BASES[intent][locale]];
      const templates = TRAINING_TEMPLATES[locale];
      for (const phrase of bases) {
        for (const template of templates) {
          exemplars.push({ intent, locale, text: applyTemplate(template, phrase) });
        }
      }
    }
  }

  return exemplars;
}

export const DEFAULT_INTENT_EXEMPLARS = generateIntentExemplars();
