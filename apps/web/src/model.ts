export type Language = "en" | "hi" | "hi-Latn";
export type StoveType = "gas" | "induction" | "coil";
export type View =
  | "library"
  | "detail"
  | "prep"
  | "cook"
  | "thali"
  | "pantry"
  | "summary"
  | "settings"
  | "nani";

export interface LocalText {
  en: string;
  hi: string;
  "hi-Latn": string;
}

export interface Substitution {
  name: LocalText;
  ratio: string;
  note: LocalText;
}

export interface Ingredient {
  id: string;
  name: LocalText;
  qty: number;
  unit: "g" | "ml" | "piece";
  prep: LocalText;
  curve: "linear" | "chilli" | "whole-spice" | "water";
  substitutions?: Substitution[];
}

export interface Recovery {
  id: string;
  failure: LocalText;
  question?: LocalText;
  fix: LocalText;
  patch?: LocalText;
}

export interface CookingStep {
  id: string;
  n: number;
  text: LocalText;
  spoken: LocalText;
  cue: LocalText;
  /** Real reference photo showing how the food should look at this step. */
  photo?: string;
  durationSec?: number;
  attention: "active" | "passive";
  risk: "normal" | "high";
  checkInIntervalSec?: number;
  flame: 1 | 2 | 3 | 4 | 5;
  cookware?: LocalText;
  whistles?: {
    count: number;
    thenFlame: number;
    thenDurationSec: number;
    manualFallback: LocalText;
  };
  recovery: Recovery[];
  stage: "prep" | "temper" | "simmer" | "finish" | "pressure" | "rest";
}

export interface RecipeCard {
  id: string;
  slug: string;
  title: LocalText;
  headnote: LocalText;
  region: LocalText;
  timeMin: number;
  difficulty: LocalText;
  tags: string[];
  servingsBase: number;
  ingredients: Ingredient[];
  steps: CookingStep[];
  cookware: LocalText;
  offlineReady: boolean;
  palette: [string, string];
  /** Real photograph of the finished dish (public/photos). */
  photo?: string;
}

export interface DishCheckRecord {
  id?: number;
  recipeId: string;
  stepId: string;
  takenAt: number;
  /** Data URL of the user's photo, kept on-device only. */
  image: string;
  /** 0–100 colour/tone similarity against the reference photo. */
  similarity?: number;
}

export interface CookTimer {
  stepId: string;
  totalSec: number;
  remainingSec: number;
  running: boolean;
  completed: boolean;
  updatedAt: number;
}

export interface CookSession {
  id: string;
  recipeId: string;
  servings: number;
  stepIndex: number;
  startedAt: number;
  updatedAt: number;
  paused: boolean;
  completed: boolean;
  timer?: CookTimer;
  whistleCount: number;
  checkedIngredients: string[];
  recoveries: string[];
  substitutions: Record<string, string>;
  note?: string;
}

export interface Preferences {
  language: Language;
  stove: StoveType;
  katoriMl: number;
  spice: "mild" | "medium" | "hot";
  onDeviceVoice: boolean;
  sounds: boolean;
  lowBatteryMode: boolean;
  devanagariNumerals: boolean;
}

export const defaultPreferences: Preferences = {
  language: "hi-Latn",
  stove: "gas",
  katoriMl: 180,
  spice: "medium",
  onDeviceVoice: false,
  sounds: true,
  lowBatteryMode: false,
  devanagariNumerals: false
};

export const localText = (value: LocalText, language: Language): string => value[language] || value.en;
