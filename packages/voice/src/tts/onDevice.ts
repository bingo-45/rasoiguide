import type { AdapterAvailability, ModelLoadProgress, ModelLoadState, OnDeviceAdapter } from "../on-device/types.js";
import type { TtsAdapter, TtsRequest, TtsVoice } from "./types.js";

export interface SynthesizedAudio {
  samples: Float32Array;
  sampleRate: number;
}

export interface LocalTtsRuntime {
  readonly id: string;
  load(onProgress?: (progress: ModelLoadProgress) => void): Promise<void>;
  voices(): Promise<readonly TtsVoice[]>;
  synthesize(request: Omit<TtsRequest, "signal">, signal: AbortSignal): Promise<SynthesizedAudio>;
  dispose(): void | Promise<void>;
}

export interface LocalAudioOutput {
  play(audio: SynthesizedAudio, signal: AbortSignal): Promise<void>;
  cancel(): void;
}

/** Piper/sherpa-onnx compatible facade; model runtime and WebAudio output are injected and lazy. */
export class OnDeviceTtsAdapter implements TtsAdapter, OnDeviceAdapter {
  readonly id: string;
  readonly mode = "on-device" as const;
  #loadState: ModelLoadState = "idle";
  #controller: AbortController | undefined;

  constructor(
    private readonly runtime: LocalTtsRuntime,
    private readonly output: LocalAudioOutput
  ) {
    this.id = `local-tts:${runtime.id}`;
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

  async voices(): Promise<readonly TtsVoice[]> {
    await this.prepare();
    return this.runtime.voices();
  }

  async speak(request: TtsRequest): Promise<void> {
    await this.prepare();
    this.cancel();
    const controller = new AbortController();
    this.#controller = controller;
    const onExternalAbort = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener("abort", onExternalAbort, { once: true });
    try {
      const synthesisRequest = { ...request };
      delete synthesisRequest.signal;
      const audio = await this.runtime.synthesize(synthesisRequest, controller.signal);
      await this.output.play(audio, controller.signal);
    } finally {
      request.signal?.removeEventListener("abort", onExternalAbort);
      if (this.#controller === controller) this.#controller = undefined;
    }
  }

  cancel(): void {
    this.#controller?.abort("cancelled");
    this.#controller = undefined;
    this.output.cancel();
  }

  async dispose(): Promise<void> {
    this.cancel();
    await this.runtime.dispose();
    this.#loadState = "idle";
  }
}
