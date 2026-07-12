import type { ParsedNumber } from "../numbers/parser.js";

export const INTENTS = [
  "advance",
  "go-back",
  "repeat",
  "quantity-query",
  "timer-query",
  "flame-query",
  "troubleshoot",
  "pause-everything",
  "switch-dish",
  "whistle-report",
  "substitute-query"
] as const;

export type Intent = (typeof INTENTS)[number];
export type VoiceLocale = "en" | "hi" | "hinglish";

export interface IntentExemplar {
  intent: Intent;
  locale: VoiceLocale;
  text: string;
}

export interface IntentCandidate {
  intent: Intent;
  score: number;
  closestExemplar: string;
}

export type IntentResolution =
  | {
      status: "resolved";
      transcript: string;
      normalizedTranscript: string;
      intent: Intent;
      confidence: number;
      candidates: readonly IntentCandidate[];
      numbers: readonly ParsedNumber[];
    }
  | {
      status: "ambiguous";
      transcript: string;
      normalizedTranscript: string;
      candidates: readonly IntentCandidate[];
      numbers: readonly ParsedNumber[];
    };
