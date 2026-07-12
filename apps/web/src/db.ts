import Dexie, { type EntityTable } from "dexie";
import type { CookSession, DishCheckRecord, Preferences } from "./model";

interface PreferenceRecord extends Preferences {
  id: "primary";
}

interface TransitionRecord {
  id?: number;
  sessionId: string;
  at: number;
  kind: string;
  snapshot: CookSession;
}

interface IntentUnknownRecord {
  id?: number;
  at: number;
  transcript: string;
  candidates: string[];
}

interface CookHistoryRecord {
  id?: number;
  recipeId: string;
  completedAt: number;
  elapsedSec: number;
  recoveries: string[];
  note?: string;
}

class RasoiDatabase extends Dexie {
  sessions!: EntityTable<CookSession, "id">;
  preferences!: EntityTable<PreferenceRecord, "id">;
  transitions!: EntityTable<TransitionRecord, "id">;
  intentUnknowns!: EntityTable<IntentUnknownRecord, "id">;
  cookHistory!: EntityTable<CookHistoryRecord, "id">;
  dishChecks!: EntityTable<DishCheckRecord, "id">;

  constructor() {
    super("rasoiguide-local-v2");
    this.version(1).stores({
      sessions: "id, recipeId, updatedAt",
      preferences: "id",
      transitions: "++id, sessionId, at, kind",
      intentUnknowns: "++id, at",
      cookHistory: "++id, recipeId, completedAt"
    });
    this.version(2).stores({
      dishChecks: "++id, recipeId, stepId, takenAt"
    });
  }
}

export const db = new RasoiDatabase();
const ACTIVE_SESSION_JOURNAL_KEY = "rasoiguide:active-session-journal";

function readSessionJournal(): CookSession | undefined {
  if (typeof localStorage === "undefined") return undefined;
  const raw = localStorage.getItem(ACTIVE_SESSION_JOURNAL_KEY);
  if (!raw) return undefined;
  try {
    const session = JSON.parse(raw) as CookSession;
    return session && typeof session.id === "string" && typeof session.updatedAt === "number" ? session : undefined;
  } catch {
    return undefined;
  }
}

export async function persistPreferences(preferences: Preferences): Promise<void> {
  await db.preferences.put({ id: "primary", ...preferences });
}

export async function loadPreferences(): Promise<Preferences | undefined> {
  const record = await db.preferences.get("primary");
  if (!record) return undefined;
  return {
    language: record.language,
    stove: record.stove,
    katoriMl: record.katoriMl,
    spice: record.spice,
    onDeviceVoice: record.onDeviceVoice,
    sounds: record.sounds,
    lowBatteryMode: record.lowBatteryMode,
    devanagariNumerals: record.devanagariNumerals
  };
}

export async function persistSession(session: CookSession, kind: string): Promise<void> {
  // Synchronous write-ahead journal closes the tiny crash window before IndexedDB commits.
  // IndexedDB remains authoritative after its transaction completes.
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(ACTIVE_SESSION_JOURNAL_KEY, JSON.stringify(session));
  }
  await db.transaction("rw", db.sessions, db.transitions, async () => {
    await db.sessions.put(session);
    await db.transitions.add({ sessionId: session.id, at: Date.now(), kind, snapshot: structuredClone(session) });
    const old = await db.transitions.where("sessionId").equals(session.id).reverse().offset(50).toArray();
    if (old.length) await db.transitions.bulkDelete(old.flatMap((item) => (item.id ? [item.id] : [])));
  });
}

export async function loadActiveSession(): Promise<CookSession | undefined> {
  const [indexed, journal] = await Promise.all([
    db.sessions.orderBy("updatedAt").reverse().filter((session) => !session.completed).first(),
    Promise.resolve(readSessionJournal())
  ]);
  const activeJournal = journal && !journal.completed ? journal : undefined;
  if (activeJournal && (!indexed || activeJournal.updatedAt >= indexed.updatedAt)) return activeJournal;
  return indexed;
}

export async function logIntentUnknown(transcript: string, candidates: string[]): Promise<void> {
  await db.intentUnknowns.add({ at: Date.now(), transcript, candidates });
}

export async function archiveSession(session: CookSession): Promise<void> {
  await db.cookHistory.add({
    recipeId: session.recipeId,
    completedAt: Date.now(),
    elapsedSec: Math.max(0, Math.round((Date.now() - session.startedAt) / 1000)),
    recoveries: session.recoveries,
    note: session.note
  });
  await persistSession({ ...session, completed: true, updatedAt: Date.now() }, "completed");
}

export async function saveDishCheck(record: DishCheckRecord): Promise<void> {
  await db.dishChecks.add(record);
  // Keep only the latest 30 checks so photos never bloat the phone.
  const stale = await db.dishChecks.orderBy("takenAt").reverse().offset(30).toArray();
  if (stale.length) await db.dishChecks.bulkDelete(stale.flatMap((item) => (item.id ? [item.id] : [])));
}

export async function latestDishCheck(recipeId: string, stepId: string): Promise<DishCheckRecord | undefined> {
  return db.dishChecks.where("stepId").equals(stepId).and((record) => record.recipeId === recipeId).reverse().sortBy("takenAt").then((list) => list[0]);
}

export async function requestDurableStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
