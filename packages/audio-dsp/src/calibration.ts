import type {
  WhistleCalibrationRecord,
  WhistleCalibrationStore,
} from "./types";

const DEFAULT_PREFIX = "rasoiguide:whistle-calibration:";

function isRecord(value: unknown): value is WhistleCalibrationRecord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<WhistleCalibrationRecord>;
  return (
    typeof candidate.multiplier === "number" &&
    Number.isFinite(candidate.multiplier) &&
    candidate.multiplier > 0 &&
    typeof candidate.confirmedAtMs === "number" &&
    Number.isFinite(candidate.confirmedAtMs)
  );
}

/** A tiny adapter so calibration remains local to the device. */
export class LocalStorageWhistleCalibrationStore implements WhistleCalibrationStore {
  public constructor(
    private readonly storage: Pick<Storage, "getItem" | "setItem">,
    private readonly keyPrefix = DEFAULT_PREFIX,
  ) {}

  public load(userId: string): WhistleCalibrationRecord | undefined {
    const raw = this.storage.getItem(`${this.keyPrefix}${userId}`);
    if (raw === null) return undefined;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  public save(userId: string, record: WhistleCalibrationRecord): void {
    this.storage.setItem(`${this.keyPrefix}${userId}`, JSON.stringify(record));
  }
}
