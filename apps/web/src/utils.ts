import type { Ingredient, Language, StoveType } from "./model";

const devanagariDigits = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

export const toDevanagari = (value: string | number): string =>
  String(value).replace(/\d/g, (digit) => devanagariDigits[Number(digit)] ?? digit);

export const displayNumber = (value: string | number, language: Language, enabled: boolean): string =>
  language === "hi" && enabled ? toDevanagari(value) : String(value);

export const formatTime = (seconds: number): string => {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const exponentFor = (curve: Ingredient["curve"]): number => {
  if (curve === "chilli") return 0.8;
  if (curve === "whole-spice") return 0.7;
  if (curve === "water") return 0.9;
  return 1;
};

export const scaledQuantity = (ingredient: Ingredient, servings: number, baseServings: number): number => {
  const factor = Math.max(0.25, servings / baseServings);
  return ingredient.qty * Math.pow(factor, exponentFor(ingredient.curve));
};

const trimNumber = (value: number): string => {
  if (value >= 100) return String(Math.round(value / 5) * 5);
  if (value >= 10) return String(Math.round(value));
  return String(Math.round(value * 10) / 10);
};

export const householdMeasure = (
  ingredient: Ingredient,
  servings: number,
  baseServings: number,
  katoriMl: number
): { canonical: string; andaaz: string } => {
  const qty = scaledQuantity(ingredient, servings, baseServings);
  const canonical = `${trimNumber(qty)} ${ingredient.unit === "piece" ? (qty > 1.4 ? "pieces" : "piece") : ingredient.unit}`;
  let measure = "";
  if (ingredient.unit === "ml") {
    const katori = qty / katoriMl;
    measure = katori >= 0.65 ? `${trimNumber(katori * 0.92)}–${trimNumber(katori * 1.08)} katori` : `${trimNumber(qty / 15)} tbsp`;
  } else if (ingredient.unit === "g" && qty >= 80) {
    const approxKatori = qty / (katoriMl * 0.82);
    measure = `${trimNumber(approxKatori * 0.9)}–${trimNumber(approxKatori * 1.1)} katori`;
  } else if (ingredient.unit === "g") {
    measure = qty <= 3 ? "1–2 pinches" : `${trimNumber(qty / 5)} tsp`;
  } else {
    measure = canonical;
  }
  return { canonical, andaaz: measure };
};

const flameLabels: Record<StoveType, Record<number, { en: string; hi: string; "hi-Latn": string }>> = {
  gas: {
    1: { en: "off / residual heat", hi: "बंद / बची गर्मी", "hi-Latn": "band / residual heat" },
    2: { en: "low, small steady flame", hi: "धीमी, छोटी स्थिर लौ", "hi-Latn": "low, chhoti stable flame" },
    3: { en: "medium, pan-width flame", hi: "मध्यम, पैन जितनी लौ", "hi-Latn": "medium, pan-width flame" },
    4: { en: "medium-high", hi: "मध्यम-तेज़", "hi-Latn": "medium-high" },
    5: { en: "high until pressure", hi: "प्रेशर तक तेज़", "hi-Latn": "pressure tak high" }
  },
  induction: {
    1: { en: "off / keep warm", hi: "बंद / गरम रखें", "hi-Latn": "off / keep warm" },
    2: { en: "350–500 W", hi: "350–500 वॉट", "hi-Latn": "350–500 W" },
    3: { en: "700–900 W", hi: "700–900 वॉट", "hi-Latn": "700–900 W" },
    4: { en: "1100–1300 W", hi: "1100–1300 वॉट", "hi-Latn": "1100–1300 W" },
    5: { en: "1500–1800 W briefly", hi: "थोड़ी देर 1500–1800 वॉट", "hi-Latn": "briefly 1500–1800 W" }
  },
  coil: {
    1: { en: "off; move pan away", hi: "बंद; पैन हटा लें", "hi-Latn": "off; pan hata lo" },
    2: { en: "low, allow for lag", hi: "धीमी; गर्मी देर से घटेगी", "hi-Latn": "low; heat lag yaad rakho" },
    3: { en: "medium", hi: "मध्यम", "hi-Latn": "medium" },
    4: { en: "medium-high", hi: "मध्यम-तेज़", "hi-Latn": "medium-high" },
    5: { en: "high, then move off coil", hi: "तेज़, फिर कॉइल से हटा लें", "hi-Latn": "high, phir coil se hatao" }
  }
};

export const flameInstruction = (stove: StoveType, level: number, language: Language): string =>
  flameLabels[stove][level]?.[language] ?? flameLabels.gas[3]![language];

/** App base path ("/" in dev, e.g. "/rasoiguide/" on GitHub Pages). Always ends with "/". */
export const APP_BASE: string = typeof import.meta.env?.BASE_URL === "string" ? import.meta.env.BASE_URL : "/";

/** Path relative to the app base, always starting with "/". */
export const relativePath = (pathname: string): string => {
  const trimmedBase = APP_BASE.replace(/\/$/, "");
  const rel = trimmedBase && pathname.startsWith(trimmedBase) ? pathname.slice(trimmedBase.length) : pathname;
  return rel.startsWith("/") ? rel : `/${rel}`;
};

export const routeForView = (view: string, recipeSlug?: string): string => {
  const prefix = APP_BASE.replace(/\/$/, "");
  if (view === "detail" && recipeSlug) return `${prefix}/recipe/${recipeSlug}`;
  if (view === "prep") return `${prefix}/prep/current`;
  if (view === "cook") return `${prefix}/cook/current`;
  if (view === "thali") return `${prefix}/thali/current`;
  if (view === "summary") return `${prefix}/summary/current`;
  if (view === "library") return APP_BASE;
  return `${prefix}/${view}`;
};
