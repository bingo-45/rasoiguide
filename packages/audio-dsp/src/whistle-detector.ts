import type {
  BandEnergyFrame,
  WhistleCalibrationRecord,
  WhistleDetectorConfig,
  WhistleDetectorOptions,
  WhistleDetectorSnapshot,
  WhistleDetectorState,
  WhistleEvent,
  WhistleFrameResult,
} from "./types";

export const DEFAULT_WHISTLE_DETECTOR_CONFIG: Readonly<WhistleDetectorConfig> = {
  fftSize: 2048,
  bandLowHz: 1_500,
  bandHighHz: 4_000,
  ambientWindowMs: 10_000,
  ambientWarmupMs: 1_000,
  minimumAmbientFrames: 8,
  enterThresholdDb: 18,
  // A 6 dB hysteresis gap keeps borderline frames from chopping one whistle
  // into several candidates.
  exitThresholdDb: 12,
  minimumDurationMs: 600,
  maximumDurationMs: 3_500,
  refractoryMs: 8_000,
  calibrationMultiplier: 1,
};

interface AmbientSample {
  readonly timestampMs: number;
  readonly db: number;
}

function median(values: readonly number[]): number {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle]!;
  return (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function assertPositive(label: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be greater than zero`);
  }
}

function validateConfig(config: WhistleDetectorConfig): void {
  if (config.fftSize !== 2048) {
    throw new RangeError("Whistle detector fftSize must be exactly 2048");
  }
  assertPositive("Band lower bound", config.bandLowHz);
  if (config.bandHighHz <= config.bandLowHz) {
    throw new RangeError("Band upper bound must exceed its lower bound");
  }
  assertPositive("Ambient window", config.ambientWindowMs);
  if (config.ambientWarmupMs < 0 || config.ambientWarmupMs > config.ambientWindowMs) {
    throw new RangeError("Ambient warmup must fit inside the ambient window");
  }
  if (!Number.isInteger(config.minimumAmbientFrames) || config.minimumAmbientFrames < 2) {
    throw new RangeError("At least two ambient frames are required");
  }
  assertPositive("Enter threshold", config.enterThresholdDb);
  if (config.exitThresholdDb < 0 || config.exitThresholdDb >= config.enterThresholdDb) {
    throw new RangeError("Exit threshold must be lower than enter threshold");
  }
  assertPositive("Minimum duration", config.minimumDurationMs);
  if (config.maximumDurationMs < config.minimumDurationMs) {
    throw new RangeError("Maximum duration cannot be shorter than minimum duration");
  }
  assertPositive("Refractory period", config.refractoryMs);
  assertPositive("Calibration multiplier", config.calibrationMultiplier);
}

/**
 * Frame-driven whistle detector. It deliberately has no timers: callers feed
 * analyser frames with monotonic timestamps, making suspend/resume and fixture
 * replay deterministic.
 */
export class WhistleDetector {
  private readonly configBase: Omit<WhistleDetectorConfig, "calibrationMultiplier">;
  private calibrationMultiplier: number;
  private readonly calibrationStore: WhistleDetectorOptions["calibrationStore"];
  private readonly userId: string;
  private calibrationConfirmed: boolean;
  private state: WhistleDetectorState = "warming";
  private ambientSamples: AmbientSample[] = [];
  private lastAmbientMedianDb: number | null = null;
  private warmupStartedAtMs: number | null = null;
  private candidateStartedAtMs: number | null = null;
  private candidatePeakDeltaDb = Number.NEGATIVE_INFINITY;
  private candidateAmbientMedianDb: number | null = null;
  private lastDetectedAtMs: number | null = null;
  private previousTimestampMs: number | null = null;
  private detectedCount = 0;

  public constructor(options: WhistleDetectorOptions = {}) {
    const userId = options.userId ?? "default";
    const stored = options.calibrationStore?.load(userId);
    const merged: WhistleDetectorConfig = {
      ...DEFAULT_WHISTLE_DETECTOR_CONFIG,
      ...options.config,
      calibrationMultiplier:
        stored?.multiplier ??
        options.config?.calibrationMultiplier ??
        DEFAULT_WHISTLE_DETECTOR_CONFIG.calibrationMultiplier,
    };
    validateConfig(merged);
    const { calibrationMultiplier, ...configBase } = merged;
    this.configBase = configBase;
    this.calibrationMultiplier = calibrationMultiplier;
    this.calibrationStore = options.calibrationStore;
    this.userId = userId;
    this.calibrationConfirmed = stored !== undefined;
  }

  /** 18 dB plus the persisted linear-power calibration adjustment. */
  public get effectiveEnterThresholdDb(): number {
    return this.configBase.enterThresholdDb + 10 * Math.log10(this.calibrationMultiplier);
  }

  public confirmCalibration(
    multiplier = this.calibrationMultiplier,
    confirmedAtMs = Date.now(),
  ): WhistleCalibrationRecord {
    assertPositive("Calibration multiplier", multiplier);
    if (!Number.isFinite(confirmedAtMs)) {
      throw new TypeError("Calibration confirmation time must be finite");
    }
    this.calibrationMultiplier = multiplier;
    this.calibrationConfirmed = true;
    const record = { multiplier, confirmedAtMs };
    this.calibrationStore?.save(this.userId, record);
    return record;
  }

  public setCalibrationMultiplier(multiplier: number): void {
    assertPositive("Calibration multiplier", multiplier);
    this.calibrationMultiplier = multiplier;
  }

  public reset(): void {
    this.state = "warming";
    this.ambientSamples = [];
    this.lastAmbientMedianDb = null;
    this.warmupStartedAtMs = null;
    this.candidateStartedAtMs = null;
    this.candidatePeakDeltaDb = Number.NEGATIVE_INFINITY;
    this.candidateAmbientMedianDb = null;
    this.lastDetectedAtMs = null;
    this.previousTimestampMs = null;
    this.detectedCount = 0;
  }

  public snapshot(): WhistleDetectorSnapshot {
    return {
      state: this.state,
      ambientMedianDb: this.currentAmbientMedian(),
      ambientSampleCount: this.ambientSamples.length,
      candidateStartedAtMs: this.candidateStartedAtMs,
      lastDetectedAtMs: this.lastDetectedAtMs,
      detectedCount: this.detectedCount,
      calibrationMultiplier: this.calibrationMultiplier,
      calibrationConfirmed: this.calibrationConfirmed,
      shouldSuspendStt: this.shouldSuspendStt(),
    };
  }

  public processFrame(frame: BandEnergyFrame): WhistleFrameResult {
    this.validateFrame(frame);
    this.previousTimestampMs = frame.timestampMs;
    this.pruneAmbient(frame.timestampMs);

    if (this.state === "warming") {
      this.addAmbient(frame);
      if (this.warmupStartedAtMs === null) this.warmupStartedAtMs = frame.timestampMs;
      const warmupElapsed = frame.timestampMs - this.warmupStartedAtMs;
      if (
        warmupElapsed >= this.configBase.ambientWarmupMs &&
        this.ambientSamples.length >= this.configBase.minimumAmbientFrames
      ) {
        this.state = "idle";
      }
      return this.result(null);
    }

    const ambientMedianDb = this.currentAmbientMedian();
    if (ambientMedianDb === null) {
      // Long rejected noise can age every sample out. Rebuild the baseline only
      // after returning to a quiet frame; keep the last known median meanwhile.
      this.state = "warming";
      this.warmupStartedAtMs = null;
      this.addAmbient(frame);
      return this.result(null);
    }
    const deltaDb = frame.bandEnergyDb - ambientMedianDb;

    switch (this.state) {
      case "idle":
        if (deltaDb >= this.effectiveEnterThresholdDb) {
          this.beginCandidate(frame.timestampMs, deltaDb, ambientMedianDb);
        } else if (deltaDb < this.configBase.exitThresholdDb) {
          this.addAmbient(frame);
        }
        return this.result(deltaDb);

      case "candidate":
        this.candidatePeakDeltaDb = Math.max(this.candidatePeakDeltaDb, deltaDb);
        if (deltaDb >= this.configBase.exitThresholdDb) {
          if (
            frame.timestampMs - this.candidateStartedAtMs! >
            this.configBase.maximumDurationMs
          ) {
            this.clearCandidate("rejecting");
          }
          return this.result(deltaDb);
        }
        return this.finishCandidate(frame, deltaDb, ambientMedianDb);

      case "rejecting":
        if (deltaDb < this.configBase.exitThresholdDb) {
          this.addAmbient(frame);
          this.state = this.isInsideRefractory(frame.timestampMs) ? "refractory" : "idle";
        }
        return this.result(deltaDb);

      case "refractory":
        if (deltaDb < this.configBase.exitThresholdDb) this.addAmbient(frame);
        if (!this.isInsideRefractory(frame.timestampMs)) {
          // A burst that began during the refractory window is never counted
          // from its tail after the window expires.
          this.state =
            deltaDb >= this.configBase.exitThresholdDb ? "rejecting" : "idle";
        }
        return this.result(deltaDb);

    }
  }

  private validateFrame(frame: BandEnergyFrame): void {
    if (!Number.isFinite(frame.timestampMs) || !Number.isFinite(frame.bandEnergyDb)) {
      throw new TypeError("Whistle frames require finite timestamp and energy values");
    }
    if (this.previousTimestampMs !== null && frame.timestampMs <= this.previousTimestampMs) {
      throw new RangeError("Whistle frame timestamps must increase monotonically");
    }
  }

  private beginCandidate(timestampMs: number, deltaDb: number, ambientMedianDb: number): void {
    this.state = "candidate";
    this.candidateStartedAtMs = timestampMs;
    this.candidatePeakDeltaDb = deltaDb;
    this.candidateAmbientMedianDb = ambientMedianDb;
  }

  private finishCandidate(
    frame: BandEnergyFrame,
    deltaDb: number,
    ambientMedianDb: number,
  ): WhistleFrameResult {
    const startedAtMs = this.candidateStartedAtMs!;
    const durationMs = frame.timestampMs - startedAtMs;
    const peakDeltaDb = this.candidatePeakDeltaDb;
    const candidateAmbientMedianDb = this.candidateAmbientMedianDb ?? ambientMedianDb;
    this.addAmbient(frame);

    if (
      durationMs >= this.configBase.minimumDurationMs &&
      durationMs <= this.configBase.maximumDurationMs
    ) {
      const event: WhistleEvent = {
        type: "whistle",
        startedAtMs,
        endedAtMs: frame.timestampMs,
        durationMs,
        ambientMedianDb: candidateAmbientMedianDb,
        peakDeltaDb,
        effectiveEnterThresholdDb: this.effectiveEnterThresholdDb,
        requiresCalibrationConfirmation: !this.calibrationConfirmed,
      };
      this.detectedCount += 1;
      this.lastDetectedAtMs = frame.timestampMs;
      this.clearCandidate("refractory");
      return this.result(deltaDb, event);
    }

    this.clearCandidate("idle");
    return this.result(deltaDb);
  }

  private clearCandidate(nextState: WhistleDetectorState): void {
    this.candidateStartedAtMs = null;
    this.candidatePeakDeltaDb = Number.NEGATIVE_INFINITY;
    this.candidateAmbientMedianDb = null;
    this.state = nextState;
  }

  private isInsideRefractory(timestampMs: number): boolean {
    return (
      this.lastDetectedAtMs !== null &&
      timestampMs - this.lastDetectedAtMs < this.configBase.refractoryMs
    );
  }

  private shouldSuspendStt(): boolean {
    return this.state === "candidate" || this.state === "rejecting";
  }

  private addAmbient(frame: BandEnergyFrame): void {
    this.ambientSamples.push({ timestampMs: frame.timestampMs, db: frame.bandEnergyDb });
    this.pruneAmbient(frame.timestampMs);
    this.lastAmbientMedianDb = median(this.ambientSamples.map((sample) => sample.db));
  }

  private pruneAmbient(nowMs: number): void {
    const cutoff = nowMs - this.configBase.ambientWindowMs;
    this.ambientSamples = this.ambientSamples.filter((sample) => sample.timestampMs >= cutoff);
  }

  private currentAmbientMedian(): number | null {
    if (this.ambientSamples.length > 0) {
      this.lastAmbientMedianDb = median(this.ambientSamples.map((sample) => sample.db));
    }
    return this.lastAmbientMedianDb;
  }

  private result(deltaDb: number | null, event?: WhistleEvent): WhistleFrameResult {
    return {
      state: this.state,
      ambientMedianDb: this.currentAmbientMedian(),
      deltaDb,
      effectiveEnterThresholdDb: this.effectiveEnterThresholdDb,
      shouldSuspendStt: this.shouldSuspendStt(),
      ...(event === undefined ? {} : { event }),
    };
  }
}
