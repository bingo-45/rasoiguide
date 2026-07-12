import type { AdapterAvailability } from "../on-device/types.js";
import type { TtsAdapter, TtsRequest, TtsVoice } from "./types.js";

interface SpeechScope {
  speechSynthesis?: SpeechSynthesis;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
}

function languageTag(locale: TtsRequest["locale"]): "en-IN" | "hi-IN" {
  return locale === "en" ? "en-IN" : "hi-IN";
}

export class WebSpeechTtsAdapter implements TtsAdapter {
  readonly id = "speech-synthesis-api";
  readonly mode = "browser" as const;
  #activeReject: ((reason: Error) => void) | undefined;

  constructor(private readonly scope: SpeechScope = globalThis as SpeechScope) {}

  availability(): AdapterAvailability {
    return this.scope.speechSynthesis && this.scope.SpeechSynthesisUtterance
      ? { available: true }
      : { available: false, reason: "speechSynthesis is unavailable in this browser" };
  }

  async voices(): Promise<readonly TtsVoice[]> {
    return (this.scope.speechSynthesis?.getVoices() ?? []).map((voice) => ({
      id: voice.voiceURI,
      name: voice.name,
      language: voice.lang,
      local: voice.localService
    }));
  }

  async speak(request: TtsRequest): Promise<void> {
    const synth = this.scope.speechSynthesis;
    const Utterance = this.scope.SpeechSynthesisUtterance;
    if (!synth || !Utterance) throw new Error("Browser speech synthesis is unavailable");
    if (request.signal?.aborted) throw new DOMException("Speech was aborted", "AbortError");

    this.cancel();
    const utterance = new Utterance(request.text);
    utterance.lang = languageTag(request.locale);
    utterance.rate = request.rate ?? 1;
    utterance.pitch = request.pitch ?? 1;
    utterance.volume = request.volume ?? 1;
    const availableVoices = synth.getVoices();
    utterance.voice = availableVoices.find((voice) => voice.voiceURI === request.voiceId)
      ?? availableVoices.find((voice) => voice.lang.toLocaleLowerCase().startsWith(utterance.lang.toLocaleLowerCase()))
      ?? availableVoices.find((voice) => voice.lang.toLocaleLowerCase().startsWith(utterance.lang.slice(0, 2).toLocaleLowerCase()))
      ?? null;

    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        synth.cancel();
        reject(new DOMException("Speech was aborted", "AbortError"));
      };
      this.#activeReject = reject;
      request.signal?.addEventListener("abort", onAbort, { once: true });
      utterance.onend = () => {
        request.signal?.removeEventListener("abort", onAbort);
        this.#activeReject = undefined;
        resolve();
      };
      utterance.onerror = (event) => {
        request.signal?.removeEventListener("abort", onAbort);
        this.#activeReject = undefined;
        reject(new Error(`Speech synthesis failed: ${event.error}`));
      };
      synth.speak(utterance);
    });
  }

  cancel(): void {
    this.scope.speechSynthesis?.cancel();
    const reject = this.#activeReject;
    this.#activeReject = undefined;
    reject?.(new Error("Speech synthesis cancelled"));
  }
}
