import type { AdapterAvailability } from "../on-device/types.js";
import type { VoiceLocale } from "../intents/types.js";

export interface PcmAudioSource {
  readonly sampleRate: number;
  readonly channels: 1;
  chunks: AsyncIterable<Float32Array>;
}

export interface SttTranscript {
  transcript: string;
  confidence?: number;
  isFinal: boolean;
  locale: VoiceLocale;
}

export type SttErrorCode =
  | "mic-denied"
  | "no-speech"
  | "network"
  | "audio-capture"
  | "unavailable"
  | "model-error"
  | "unknown";

export interface SttError {
  code: SttErrorCode;
  message: string;
  cause?: unknown;
}

export interface SttCallbacks {
  onStart?(): void;
  onSpeechStart?(): void;
  onSpeechEnd?(): void;
  onTranscript(result: SttTranscript): void;
  onError(error: SttError): void;
  onEnd?(): void;
}

export interface SttRequest {
  locale: VoiceLocale;
  continuous?: boolean;
  interimResults?: boolean;
  audio?: PcmAudioSource;
  callbacks: SttCallbacks;
}

export interface SttSession {
  stop(): void;
  abort(): void;
}

export interface SttAdapter {
  readonly id: string;
  readonly mode: "vendor" | "on-device";
  availability(): AdapterAvailability | Promise<AdapterAvailability>;
  start(request: SttRequest): Promise<SttSession>;
}
