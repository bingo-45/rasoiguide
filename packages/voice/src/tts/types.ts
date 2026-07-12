import type { AdapterAvailability } from "../on-device/types.js";
import type { VoiceLocale } from "../intents/types.js";

export interface TtsRequest {
  text: string;
  locale: VoiceLocale;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceId?: string;
  signal?: AbortSignal;
}

export interface TtsVoice {
  id: string;
  name: string;
  language: string;
  local: boolean;
}

export interface TtsAdapter {
  readonly id: string;
  readonly mode: "browser" | "on-device";
  availability(): AdapterAvailability | Promise<AdapterAvailability>;
  voices(): Promise<readonly TtsVoice[]>;
  speak(request: TtsRequest): Promise<void>;
  cancel(): void;
}
