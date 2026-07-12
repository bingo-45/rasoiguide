import type { AdapterAvailability, ModelLoadProgress, ModelLoadState, OnDeviceAdapter } from "../on-device/types.js";
import type { PcmAudioSource, SttAdapter, SttRequest, SttSession, SttTranscript } from "./types.js";

export interface LocalSttRuntime {
  readonly id: string;
  load(onProgress?: (progress: ModelLoadProgress) => void): Promise<void>;
  transcribe(
    source: PcmAudioSource,
    options: { locale: SttRequest["locale"]; signal: AbortSignal; onInterim?: (result: SttTranscript) => void }
  ): Promise<Omit<SttTranscript, "isFinal">>;
  dispose(): void | Promise<void>;
}

/** Shared adapter surface for Whisper or Vosk WASM runtimes. Audio capture stays in the web app/VAD layer. */
export class OnDeviceSttAdapter implements SttAdapter, OnDeviceAdapter {
  readonly id: string;
  readonly mode = "on-device" as const;
  #loadState: ModelLoadState = "idle";

  constructor(private readonly runtime: LocalSttRuntime) {
    this.id = `local-stt:${runtime.id}`;
  }

  get loadState(): ModelLoadState {
    return this.#loadState;
  }

  availability(): AdapterAvailability {
    return typeof WebAssembly === "undefined"
      ? { available: false, reason: "WebAssembly is unavailable on this device" }
      : { available: true };
  }

  async prepare(onProgress?: (progress: ModelLoadProgress) => void): Promise<void> {
    if (this.#loadState === "ready") return;
    this.#loadState = "loading";
    try {
      await this.runtime.load(onProgress);
      this.#loadState = "ready";
    } catch (error) {
      this.#loadState = "error";
      throw error;
    }
  }

  async start(request: SttRequest): Promise<SttSession> {
    if (!request.audio) throw new Error("On-device STT requires a VAD-gated PCM audio source");
    await this.prepare();
    const controller = new AbortController();
    request.callbacks.onStart?.();

    void this.runtime
      .transcribe(request.audio, {
        locale: request.locale,
        signal: controller.signal,
        onInterim: request.interimResults ? request.callbacks.onTranscript : undefined
      })
      .then((result) => request.callbacks.onTranscript({ ...result, isFinal: true }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        request.callbacks.onError({ code: "model-error", message: "On-device transcription failed", cause });
      })
      .finally(() => request.callbacks.onEnd?.());

    return {
      stop: () => controller.abort("stopped"),
      abort: () => controller.abort("aborted")
    };
  }

  async dispose(): Promise<void> {
    await this.runtime.dispose();
    this.#loadState = "idle";
  }
}
