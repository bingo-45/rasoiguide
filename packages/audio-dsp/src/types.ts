export type WhistleDetectorState =
  | "warming"
  | "idle"
  | "candidate"
  | "refractory"
  | "rejecting";

export interface WhistleDetectorConfig {
  readonly fftSize: 2048;
  readonly bandLowHz: number;
  readonly bandHighHz: number;
  readonly ambientWindowMs: number;
  readonly ambientWarmupMs: number;
  readonly minimumAmbientFrames: number;
  readonly enterThresholdDb: number;
  readonly exitThresholdDb: number;
  readonly minimumDurationMs: number;
  readonly maximumDurationMs: number;
  readonly refractoryMs: number;
  /**
   * Multiplies the linear power ratio represented by the 18 dB threshold.
   * 1 is neutral, values below 1 increase sensitivity, and values above 1
   * reduce sensitivity.
   */
  readonly calibrationMultiplier: number;
}

export interface BandEnergyFrame {
  readonly timestampMs: number;
  readonly bandEnergyDb: number;
}

export interface WhistleEvent {
  readonly type: "whistle";
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly ambientMedianDb: number;
  readonly peakDeltaDb: number;
  readonly effectiveEnterThresholdDb: number;
  readonly requiresCalibrationConfirmation: boolean;
}

export interface WhistleFrameResult {
  readonly state: WhistleDetectorState;
  readonly ambientMedianDb: number | null;
  readonly deltaDb: number | null;
  readonly effectiveEnterThresholdDb: number;
  readonly shouldSuspendStt: boolean;
  readonly event?: WhistleEvent;
}

export interface WhistleDetectorSnapshot {
  readonly state: WhistleDetectorState;
  readonly ambientMedianDb: number | null;
  readonly ambientSampleCount: number;
  readonly candidateStartedAtMs: number | null;
  readonly lastDetectedAtMs: number | null;
  readonly detectedCount: number;
  readonly calibrationMultiplier: number;
  readonly calibrationConfirmed: boolean;
  readonly shouldSuspendStt: boolean;
}

export interface WhistleCalibrationRecord {
  readonly multiplier: number;
  readonly confirmedAtMs: number;
}

export interface WhistleCalibrationStore {
  load(userId: string): WhistleCalibrationRecord | undefined;
  save(userId: string, record: WhistleCalibrationRecord): void;
}

export interface WhistleDetectorOptions {
  readonly config?: Partial<WhistleDetectorConfig>;
  readonly calibrationStore?: WhistleCalibrationStore;
  readonly userId?: string;
}
