import type { Intent, IntentCandidate, VoiceLocale } from "./types.js";

const LABELS: Readonly<Record<VoiceLocale, Readonly<Record<Intent, string>>>> = {
  en: {
    advance: "next step",
    "go-back": "previous step",
    repeat: "repeat",
    "quantity-query": "ingredient quantity",
    "timer-query": "time remaining",
    "flame-query": "flame level",
    troubleshoot: "something is wrong",
    "pause-everything": "pause everything",
    "switch-dish": "switch dish",
    "whistle-report": "count a whistle",
    "substitute-query": "ingredient substitute"
  },
  hi: {
    advance: "अगला कदम",
    "go-back": "पिछला कदम",
    repeat: "फिर से बोलना",
    "quantity-query": "सामग्री की मात्रा",
    "timer-query": "बचा हुआ समय",
    "flame-query": "आँच का स्तर",
    troubleshoot: "कुछ गड़बड़ है",
    "pause-everything": "सब रोकना",
    "switch-dish": "पकवान बदलना",
    "whistle-report": "सीटी गिनना",
    "substitute-query": "सामग्री का विकल्प"
  },
  hinglish: {
    advance: "agla step",
    "go-back": "pichla step",
    repeat: "repeat",
    "quantity-query": "ingredient quantity",
    "timer-query": "time remaining",
    "flame-query": "flame level",
    troubleshoot: "kuch gadbad",
    "pause-everything": "sab pause",
    "switch-dish": "dish switch",
    "whistle-report": "seeti count",
    "substitute-query": "ingredient substitute"
  }
};

export function buildSpokenDisambiguation(
  candidates: readonly IntentCandidate[],
  locale: VoiceLocale = "hinglish"
): string {
  const choices = candidates.slice(0, 3).map((candidate) => LABELS[locale][candidate.intent]);
  const joined = choices.length <= 1
    ? choices[0] ?? ""
    : `${choices.slice(0, -1).join(", ")} ${locale === "en" ? "or" : locale === "hi" ? "या" : "ya"} ${choices.at(-1)}`;
  if (locale === "hi") return `आपका मतलब है: ${joined}?`;
  if (locale === "en") return `Did you mean: ${joined}?`;
  return `Matlab: ${joined}?`;
}
