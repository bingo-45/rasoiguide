import { assign, setup } from "xstate";
import type { Intent, IntentCandidate, VoiceLocale } from "../intents/types.js";

export type VoiceMode = "web-speech" | "on-device" | "touch";
export type VoiceErrorCode = "mic-denied" | "stt-unavailable" | "runtime";

export interface HeardCommand {
  transcript: string;
  intent: Intent;
  at: number;
}

export interface VoiceContext {
  locale: VoiceLocale;
  mode: VoiceMode;
  transcript: string;
  resolvedIntent?: Intent;
  candidates: readonly IntentCandidate[];
  heardCommand?: HeardCommand;
  micMuted: boolean;
  error?: { code: VoiceErrorCode; message: string };
}

export interface VoiceMachineInput {
  locale?: VoiceLocale;
  mode?: VoiceMode;
}

export type VoiceEvent =
  | { type: "ARM" }
  | { type: "DISARM" }
  | { type: "SET_LOCALE"; locale: VoiceLocale }
  | { type: "SET_MODE"; mode: VoiceMode }
  | { type: "SPEECH_START" }
  | { type: "CAPTURE_COMPLETE" }
  | { type: "TRANSCRIPT_READY"; transcript: string }
  | { type: "INTENT_RESOLVED"; intent: Intent; candidates: readonly IntentCandidate[] }
  | { type: "INTENT_AMBIGUOUS"; candidates: readonly IntentCandidate[] }
  | { type: "CHOOSE_INTENT"; intent: Intent }
  | { type: "EXECUTION_COMPLETE"; shouldSpeak: boolean }
  | { type: "TTS_DONE" }
  | { type: "BARGE_IN_STOP" }
  | { type: "NO_SPEECH" }
  | { type: "MIC_DENIED"; message?: string }
  | { type: "STT_UNAVAILABLE"; message?: string }
  | { type: "FAIL"; message: string }
  | { type: "RETRY" }
  | { type: "USE_TOUCH" };

const initialContext: VoiceContext = {
  locale: "hinglish",
  mode: "web-speech",
  transcript: "",
  candidates: [],
  micMuted: false
};

export const voiceMachine = setup({
  types: {
    context: {} as VoiceContext,
    events: {} as VoiceEvent,
    input: {} as VoiceMachineInput | undefined
  },
  guards: {
    executionNeedsSpeech: ({ event }) => event.type === "EXECUTION_COMPLETE" && event.shouldSpeak
  },
  actions: {
    clearTurn: assign({
      transcript: "",
      resolvedIntent: undefined,
      candidates: [],
      heardCommand: undefined,
      error: undefined
    }),
    clearError: assign({ error: undefined }),
    setLocale: assign({
      locale: ({ context, event }) => event.type === "SET_LOCALE" ? event.locale : context.locale
    }),
    setMode: assign({
      mode: ({ context, event }) => event.type === "SET_MODE" ? event.mode : context.mode
    }),
    useTouch: assign({ mode: "touch", error: undefined, micMuted: false }),
    captureTranscript: assign({
      transcript: ({ context, event }) => event.type === "TRANSCRIPT_READY" ? event.transcript.trim() : context.transcript
    }),
    captureResolution: assign({
      resolvedIntent: ({ context, event }) => event.type === "INTENT_RESOLVED" ? event.intent : context.resolvedIntent,
      candidates: ({ context, event }) => event.type === "INTENT_RESOLVED" ? event.candidates : context.candidates,
      heardCommand: ({ context, event }) => event.type === "INTENT_RESOLVED"
        ? { transcript: context.transcript, intent: event.intent, at: Date.now() }
        : context.heardCommand
    }),
    captureAmbiguity: assign({
      candidates: ({ context, event }) => event.type === "INTENT_AMBIGUOUS" ? event.candidates : context.candidates
    }),
    chooseIntent: assign({
      resolvedIntent: ({ context, event }) => event.type === "CHOOSE_INTENT" ? event.intent : context.resolvedIntent,
      heardCommand: ({ context, event }) => event.type === "CHOOSE_INTENT"
        ? { transcript: context.transcript, intent: event.intent, at: Date.now() }
        : context.heardCommand
    }),
    muteMic: assign({ micMuted: true }),
    unmuteMic: assign({ micMuted: false }),
    micDenied: assign({
      mode: "touch",
      micMuted: false,
      error: ({ event }) => ({
        code: "mic-denied",
        message: event.type === "MIC_DENIED" && event.message
          ? event.message
          : "Microphone access is off. Every cooking control still works by touch."
      })
    }),
    sttUnavailable: assign({
      micMuted: false,
      error: ({ event }) => ({
        code: "stt-unavailable",
        message: event.type === "STT_UNAVAILABLE" && event.message
          ? event.message
          : "Speech recognition is unavailable. Try On-Device Mode or push to talk."
      })
    }),
    runtimeFailed: assign({
      micMuted: false,
      error: ({ event }) => ({
        code: "runtime",
        message: event.type === "FAIL" ? event.message : "Voice stopped unexpectedly."
      })
    })
  }
}).createMachine({
  id: "rasoiguide-voice",
  initial: "idle",
  context: ({ input }) => ({
    ...initialContext,
    locale: input?.locale ?? initialContext.locale,
    mode: input?.mode ?? initialContext.mode
  }),
  on: {
    SET_LOCALE: { actions: "setLocale" },
    SET_MODE: { actions: "setMode" },
    MIC_DENIED: { target: ".error", actions: "micDenied" },
    STT_UNAVAILABLE: { target: ".error", actions: "sttUnavailable" },
    FAIL: { target: ".error", actions: "runtimeFailed" }
  },
  states: {
    idle: {
      entry: "unmuteMic",
      on: {
        ARM: { target: "armed", actions: "clearTurn" }
      }
    },
    armed: {
      entry: "unmuteMic",
      on: {
        SPEECH_START: { target: "capturing", actions: "clearTurn" },
        NO_SPEECH: { target: "armed" },
        DISARM: { target: "idle", actions: "clearTurn" }
      }
    },
    capturing: {
      on: {
        CAPTURE_COMPLETE: { target: "transcribing" },
        NO_SPEECH: { target: "armed", actions: "clearTurn" },
        DISARM: { target: "idle", actions: "clearTurn" }
      }
    },
    transcribing: {
      on: {
        TRANSCRIPT_READY: { target: "resolving", actions: "captureTranscript" },
        NO_SPEECH: { target: "armed", actions: "clearTurn" },
        DISARM: { target: "idle", actions: "clearTurn" }
      }
    },
    resolving: {
      on: {
        INTENT_RESOLVED: { target: "executing", actions: "captureResolution" },
        INTENT_AMBIGUOUS: { target: "confirming", actions: "captureAmbiguity" },
        DISARM: { target: "idle", actions: "clearTurn" }
      }
    },
    confirming: {
      on: {
        CHOOSE_INTENT: { target: "executing", actions: "chooseIntent" },
        SPEECH_START: { target: "capturing", actions: "clearTurn" },
        DISARM: { target: "idle", actions: "clearTurn" }
      }
    },
    executing: {
      on: {
        EXECUTION_COMPLETE: [
          { guard: "executionNeedsSpeech", target: "speaking" },
          { target: "armed" }
        ],
        DISARM: { target: "idle", actions: "clearTurn" }
      }
    },
    speaking: {
      entry: "muteMic",
      exit: "unmuteMic",
      on: {
        TTS_DONE: { target: "armed" },
        BARGE_IN_STOP: { target: "armed", actions: "clearTurn" },
        DISARM: { target: "idle", actions: "clearTurn" }
      }
    },
    error: {
      entry: "unmuteMic",
      on: {
        RETRY: { target: "armed", actions: "clearError" },
        USE_TOUCH: { target: "idle", actions: "useTouch" },
        DISARM: { target: "idle" }
      }
    }
  }
});

export type VoiceVisualState = "idle" | "armed" | "capturing" | "resolving" | "speaking" | "error";

export function voiceVisualState(machineState: unknown): VoiceVisualState {
  if (machineState === "capturing") return "capturing";
  if (machineState === "transcribing" || machineState === "resolving" || machineState === "confirming" || machineState === "executing") return "resolving";
  if (machineState === "speaking") return "speaking";
  if (machineState === "error") return "error";
  if (machineState === "armed") return "armed";
  return "idle";
}
