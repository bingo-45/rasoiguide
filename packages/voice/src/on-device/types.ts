export type AdapterAvailability =
  | { available: true }
  | { available: false; reason: string };

export type ModelLoadState = "idle" | "loading" | "ready" | "error";

export interface ModelLoadProgress {
  file?: string;
  loaded: number;
  total?: number;
  progress: number;
}

/**
 * Common lifecycle for downloadable, entirely local voice/embedding runtimes.
 * Implementations own their caches; callers decide when a pack may be fetched.
 */
export interface OnDeviceAdapter {
  readonly id: string;
  readonly mode: "on-device";
  readonly loadState: ModelLoadState;
  availability(): AdapterAvailability | Promise<AdapterAvailability>;
  prepare(onProgress?: (progress: ModelLoadProgress) => void): Promise<void>;
  dispose(): void | Promise<void>;
}
