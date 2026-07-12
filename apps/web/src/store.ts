import { create } from "zustand";
import { archiveSession, loadActiveSession, loadPreferences, persistPreferences, persistSession } from "./db";
import { recipeById } from "./data/recipes";
import { defaultPreferences, type CookSession, type Preferences, type View } from "./model";

type VoiceVisualState = "idle" | "armed" | "capturing" | "transcribing" | "resolving" | "speaking" | "error";

interface AppState {
  hydrated: boolean;
  view: View;
  previousView: View;
  selectedRecipeId: string;
  session?: CookSession;
  preferences: Preferences;
  thaliRecipeIds: string[];
  voiceState: VoiceVisualState;
  heard?: { transcript: string; intent: string; at: number };
  hydrate: () => Promise<void>;
  navigate: (view: View) => void;
  selectRecipe: (recipeId: string) => void;
  setThaliRecipes: (ids: string[]) => void;
  resumeCooking: () => Promise<void>;
  startPrep: (recipeId?: string) => void;
  toggleIngredient: (ingredientId: string) => void;
  applySubstitution: (ingredientId: string, substitution: string) => void;
  beginCooking: (skipPrep?: boolean) => void;
  changeStep: (direction: 1 | -1) => void;
  startTimer: (seconds: number, stepId: string) => void;
  tickTimer: () => void;
  togglePause: () => void;
  addWhistle: (delta?: number) => void;
  recordRecovery: (recoveryId: string) => void;
  completeCook: () => void;
  saveNote: (note: string) => void;
  updatePreferences: (patch: Partial<Preferences>) => void;
  setVoiceState: (voiceState: VoiceVisualState) => void;
  setHeard: (transcript: string, intent: string) => void;
}

const newSession = (recipeId: string): CookSession => ({
  id: crypto.randomUUID(),
  recipeId,
  stepIndex: 0,
  startedAt: Date.now(),
  updatedAt: Date.now(),
  paused: false,
  completed: false,
  whistleCount: 0,
  checkedIngredients: [],
  recoveries: [],
  substitutions: {}
});

const save = (session: CookSession | undefined, kind: string): void => {
  if (session) void persistSession(session, kind);
};

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  view: "library",
  previousView: "library",
  selectedRecipeId: "dal-tadka",
  preferences: defaultPreferences,
  thaliRecipeIds: ["dal-tadka", "jeera-rice"],
  voiceState: "idle",

  hydrate: async () => {
    try {
      const [preferences, session] = await Promise.all([loadPreferences(), loadActiveSession()]);
      const currentSession = get().session;
      const freshestSession = currentSession && (!session || currentSession.updatedAt >= session.updatedAt)
        ? currentSession
        : session;
      set({
        hydrated: true,
        preferences: preferences ?? defaultPreferences,
        session: freshestSession,
        selectedRecipeId: freshestSession?.recipeId ?? "dal-tadka"
      });
    } catch {
      set({ hydrated: true });
    }
  },

  navigate: (view) => set((state) => ({ previousView: state.view, view })),

  selectRecipe: (recipeId) => set((state) => ({ selectedRecipeId: recipeId, previousView: state.view, view: "detail" })),

  setThaliRecipes: (ids) => set({ thaliRecipeIds: ids.slice(0, 3) }),

  resumeCooking: async () => {
    const durableSession = await loadActiveSession();
    const currentSession = get().session;
    const session = durableSession ?? currentSession;
    if (!session || session.completed) return;
    set((state) => ({
      session,
      selectedRecipeId: session.recipeId,
      previousView: state.view,
      view: "cook",
      voiceState: session.paused ? "idle" : "armed"
    }));
  },

  startPrep: (recipeId) => {
    const selectedRecipeId = recipeId ?? get().selectedRecipeId;
    const existing = get().session;
    const session = existing && !existing.completed && existing.recipeId === selectedRecipeId ? existing : newSession(selectedRecipeId);
    set((state) => ({ selectedRecipeId, session, previousView: state.view, view: "prep" }));
    save(session, "prep-started");
  },

  toggleIngredient: (ingredientId) => {
    const current = get().session;
    if (!current) return;
    const checked = current.checkedIngredients.includes(ingredientId)
      ? current.checkedIngredients.filter((id) => id !== ingredientId)
      : [...current.checkedIngredients, ingredientId];
    const session = { ...current, checkedIngredients: checked, updatedAt: Date.now() };
    set({ session });
    save(session, "ingredient-toggled");
  },

  applySubstitution: (ingredientId, substitution) => {
    const current = get().session;
    if (!current) return;
    const checkedIngredients = current.checkedIngredients.includes(ingredientId)
      ? current.checkedIngredients
      : [...current.checkedIngredients, ingredientId];
    const session = {
      ...current,
      substitutions: { ...current.substitutions, [ingredientId]: substitution },
      checkedIngredients,
      updatedAt: Date.now()
    };
    set({ session });
    save(session, "substitution-applied");
  },

  beginCooking: (skipPrep = false) => {
    const current = get().session ?? newSession(get().selectedRecipeId);
    const recipe = recipeById(current.recipeId);
    const session = {
      ...current,
      checkedIngredients: skipPrep ? recipe.ingredients.map((item) => item.id) : current.checkedIngredients,
      updatedAt: Date.now()
    };
    set((state) => ({ session, previousView: state.view, view: "cook", voiceState: "armed" }));
    save(session, "cooking-started");
  },

  changeStep: (direction) => {
    const current = get().session;
    if (!current) return;
    const recipe = recipeById(current.recipeId);
    const nextIndex = Math.min(recipe.steps.length - 1, Math.max(0, current.stepIndex + direction));
    const session = {
      ...current,
      stepIndex: nextIndex,
      timer: undefined,
      whistleCount: direction > 0 ? 0 : current.whistleCount,
      updatedAt: Date.now()
    };
    set({ session });
    save(session, direction > 0 ? "step-advanced" : "step-back");
  },

  startTimer: (seconds, stepId) => {
    const current = get().session;
    if (!current) return;
    const session = {
      ...current,
      timer: { stepId, totalSec: seconds, remainingSec: seconds, running: true, completed: false, updatedAt: Date.now() },
      updatedAt: Date.now()
    };
    set({ session });
    save(session, "timer-started");
  },

  tickTimer: () => {
    const current = get().session;
    const timer = current?.timer;
    if (!current || !timer || !timer.running || current.paused || timer.completed) return;
    const now = Date.now();
    const elapsed = Math.max(1, Math.floor((now - timer.updatedAt) / 1000));
    const remainingSec = Math.max(0, timer.remainingSec - elapsed);
    const session = {
      ...current,
      timer: { ...timer, remainingSec, updatedAt: now, running: remainingSec > 0, completed: remainingSec === 0 },
      updatedAt: now
    };
    set({ session });
    if (remainingSec === 0) save(session, "timer-completed");
  },

  togglePause: () => {
    const current = get().session;
    if (!current) return;
    const now = Date.now();
    const paused = !current.paused;
    const session = {
      ...current,
      paused,
      timer: current.timer ? { ...current.timer, running: paused ? false : !current.timer.completed, updatedAt: now } : undefined,
      updatedAt: now
    };
    set({ session, voiceState: paused ? "idle" : "armed" });
    save(session, paused ? "all-paused" : "all-resumed");
  },

  addWhistle: (delta = 1) => {
    const current = get().session;
    if (!current) return;
    const session = { ...current, whistleCount: Math.max(0, current.whistleCount + delta), updatedAt: Date.now() };
    set({ session });
    save(session, delta > 0 ? "whistle-counted" : "whistle-undone");
  },

  recordRecovery: (recoveryId) => {
    const current = get().session;
    if (!current) return;
    const session = {
      ...current,
      recoveries: current.recoveries.includes(recoveryId) ? current.recoveries : [...current.recoveries, recoveryId],
      updatedAt: Date.now()
    };
    set({ session });
    save(session, "recovery-used");
  },

  completeCook: () => {
    const current = get().session;
    if (!current) return;
    const session = { ...current, completed: true, updatedAt: Date.now() };
    set((state) => ({ session, previousView: state.view, view: "summary", voiceState: "idle" }));
    void archiveSession(session);
  },

  saveNote: (note) => {
    const current = get().session;
    if (!current) return;
    const session = { ...current, note, updatedAt: Date.now() };
    set({ session });
    save(session, "note-saved");
  },

  updatePreferences: (patch) => {
    const preferences = { ...get().preferences, ...patch };
    set({ preferences });
    void persistPreferences(preferences);
  },

  setVoiceState: (voiceState) => set({ voiceState }),

  setHeard: (transcript, intent) => set({ heard: { transcript, intent, at: Date.now() } })
}));
