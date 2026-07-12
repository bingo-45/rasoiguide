import type { AdapterAvailability } from "../on-device/types.js";
import type { SttAdapter, SttErrorCode, SttRequest, SttSession } from "./types.js";

export const WEB_SPEECH_PRIVACY_NOTICE =
  "Browser speech recognition may send microphone audio to the browser vendor. Choose On-Device Mode to keep recognition local.";

interface BrowserSpeechAlternative {
  transcript: string;
  confidence: number;
}

interface BrowserSpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: BrowserSpeechAlternative;
}

interface BrowserSpeechResultList {
  readonly length: number;
  readonly [index: number]: BrowserSpeechResult;
}

interface BrowserSpeechEvent {
  readonly resultIndex: number;
  readonly results: BrowserSpeechResultList;
}

interface BrowserSpeechErrorEvent {
  readonly error: string;
  readonly message?: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onresult: ((event: BrowserSpeechEvent) => void) | null;
  onerror: ((event: BrowserSpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

interface SpeechRecognitionGlobal {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
}

function recognitionConstructor(scope: unknown): BrowserSpeechRecognitionConstructor | undefined {
  if (!scope || typeof scope !== "object") return undefined;
  const candidate = scope as SpeechRecognitionGlobal;
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition;
}

function localeTag(locale: SttRequest["locale"]): "en-IN" | "hi-IN" {
  return locale === "en" ? "en-IN" : "hi-IN";
}

function mapError(error: string): SttErrorCode {
  if (error === "not-allowed" || error === "service-not-allowed") return "mic-denied";
  if (error === "no-speech") return "no-speech";
  if (error === "network") return "network";
  if (error === "audio-capture") return "audio-capture";
  return "unknown";
}

export class WebSpeechSttAdapter implements SttAdapter {
  readonly id = "web-speech-api";
  readonly mode = "vendor" as const;

  constructor(private readonly scope: unknown = globalThis) {}

  availability(): AdapterAvailability {
    return recognitionConstructor(this.scope)
      ? { available: true }
      : { available: false, reason: "SpeechRecognition is not exposed by this browser" };
  }

  async start(request: SttRequest): Promise<SttSession> {
    const Constructor = recognitionConstructor(this.scope);
    if (!Constructor) {
      throw new Error("Web Speech recognition is unavailable");
    }

    const recognition = new Constructor();
    let ended = false;
    recognition.lang = localeTag(request.locale);
    recognition.continuous = request.continuous ?? false;
    recognition.interimResults = request.interimResults ?? true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => request.callbacks.onStart?.();
    recognition.onspeechstart = () => request.callbacks.onSpeechStart?.();
    recognition.onspeechend = () => request.callbacks.onSpeechEnd?.();
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result?.[0];
        if (!result || !alternative) continue;
        request.callbacks.onTranscript({
          transcript: alternative.transcript.trim(),
          confidence: Number.isFinite(alternative.confidence) ? alternative.confidence : undefined,
          isFinal: result.isFinal,
          locale: request.locale
        });
      }
    };
    recognition.onerror = (event) => {
      request.callbacks.onError({
        code: mapError(event.error),
        message: event.message || `Speech recognition failed: ${event.error}`
      });
    };
    recognition.onend = () => {
      if (ended) return;
      ended = true;
      request.callbacks.onEnd?.();
    };

    recognition.start();
    return {
      stop: () => recognition.stop(),
      abort: () => recognition.abort()
    };
  }
}
