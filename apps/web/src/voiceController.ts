import { useCallback, useEffect, useRef, useState } from "react";
import { createDefaultIntentClassifier } from "@rasoiguide/voice";
import type { Language } from "./model";

type CommandIntent =
  | "advance"
  | "go-back"
  | "repeat"
  | "quantity-query"
  | "timer-query"
  | "flame-query"
  | "troubleshoot"
  | "pause-everything"
  | "whistle-report"
  | "substitute-query"
  | "switch-dish"
  | "unknown";

interface RecognitionResultLike {
  0: { transcript: string; confidence: number };
  isFinal: boolean;
}

interface RecognitionEventLike extends Event {
  results: ArrayLike<RecognitionResultLike>;
  resultIndex: number;
}

interface RecognitionErrorLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const examples: Record<Exclude<CommandIntent, "unknown">, string[]> = {
  advance: ["next step", "this is done", "aage badho", "agla step", "ho gaya", "yeh hogya", "अब आगे", "अगला स्टेप"],
  "go-back": ["go back", "previous step", "wapas jao", "peeche chalo", "पिछला स्टेप", "वापस जाओ"],
  repeat: ["repeat that", "say again", "phir se bolo", "dobara batao", "फिर से बोलो", "दोबारा बताओ"],
  "quantity-query": ["how much do I add", "what quantity", "kitna dalna hai", "quantity batao", "कितना डालना है", "मात्रा बताओ"],
  "timer-query": ["how much time left", "timer remaining", "kitna time bacha", "time batao", "कितना टाइम बचा", "टाइमर बताओ"],
  "flame-query": ["what flame", "heat level", "aanch kitni", "gas kaisi", "आंच कितनी", "गैस कैसी"],
  troubleshoot: ["something is wrong", "help me fix this", "kuch gadbad hai", "jal raha hai", "कुछ गड़बड़ है", "जल रहा है"],
  "pause-everything": ["pause everything", "stop for now", "ruko", "bas", "sab roko", "रुको", "सब रोक दो"],
  "whistle-report": ["one whistle happened", "count a whistle", "ek seeti hui", "seeti gino", "एक सीटी हुई", "सीटी गिनो"],
  "substitute-query": ["I do not have this", "what can I use instead", "nahi hai", "badle mein kya", "नहीं है", "बदले में क्या"],
  "switch-dish": ["switch dish", "go to rice", "chawal pe chalo", "dal kholo", "डिश बदलो", "चावल पर चलो"]
};

const fillers = new Set(["umm", "um", "uh", "toh", "तो", "matlab", "मतलब", "like", "yaar", "please", "zara", "ज़रा"]);

const normalize = (value: string): string => value
  .toLocaleLowerCase("hi-IN")
  .replace(/[^\p{L}\p{N}\s]/gu, " ")
  .split(/\s+/)
  .filter((token) => token && !fillers.has(token))
  .join(" ");

const grams = (value: string): Map<string, number> => {
  const padded = `  ${normalize(value)}  `;
  const vector = new Map<string, number>();
  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= padded.length - size; index += 1) {
      const gram = padded.slice(index, index + size);
      vector.set(gram, (vector.get(gram) ?? 0) + 1);
    }
  }
  return vector;
};

const cosine = (a: Map<string, number>, b: Map<string, number>): number => {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  a.forEach((value, key) => { dot += value * (b.get(key) ?? 0); aa += value * value; });
  b.forEach((value) => { bb += value * value; });
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
};

const exemplarVectors = Object.fromEntries(Object.entries(examples).map(([intent, values]) => [intent, values.map(grams)])) as Record<Exclude<CommandIntent, "unknown">, Array<Map<string, number>>>;

const fallbackResolveCommand = (transcript: string): { intent: CommandIntent; confidence: number; alternatives: CommandIntent[] } => {
  const input = grams(transcript);
  const ranked = (Object.keys(exemplarVectors) as Array<Exclude<CommandIntent, "unknown">>)
    .map((intent) => ({ intent, score: Math.max(...exemplarVectors[intent].map((vector) => cosine(input, vector))) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return {
    intent: best && best.score >= 0.38 ? best.intent : "unknown",
    confidence: best?.score ?? 0,
    alternatives: ranked.slice(0, 3).map((item) => item.intent)
  };
};

const semanticClassifier = createDefaultIntentClassifier({ threshold: 0.62, topK: 3 });

export const resolveCommand = async (transcript: string): Promise<{ intent: CommandIntent; confidence: number; alternatives: CommandIntent[] }> => {
  try {
    const result = await semanticClassifier.classify(transcript);
    if (result.status === "resolved") {
      return {
        intent: result.intent,
        confidence: result.confidence,
        alternatives: result.candidates.map((candidate) => candidate.intent)
      };
    }
    return { intent: "unknown", confidence: result.candidates[0]?.score ?? 0, alternatives: result.candidates.map((candidate) => candidate.intent) };
  } catch {
    return fallbackResolveCommand(transcript);
  }
};

interface VoiceControllerOptions {
  language: Language;
  disabled: boolean;
  onState: (state: "idle" | "armed" | "capturing" | "transcribing" | "resolving" | "speaking" | "error") => void;
  onResolved: (transcript: string, intent: CommandIntent, alternatives: CommandIntent[]) => void;
}

export function useVoiceController({ language, disabled, onState, onResolved }: VoiceControllerOptions) {
  const recognition = useRef<SpeechRecognitionLike>();
  const [supported] = useState(() => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  const [handsFree, setHandsFree] = useState(false);
  const speaking = useRef(false);
  const handsFreeRef = useRef(false);
  const restartTimer = useRef<number>();

  useEffect(() => () => {
    handsFreeRef.current = false;
    window.clearTimeout(restartTimer.current);
    recognition.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  const beginRecognition = useCallback((continuous: boolean) => {
    if (disabled) return;
    const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Constructor) {
      onState("error");
      return;
    }
    speaking.current = false;
    const instance = new Constructor();
    recognition.current = instance;
    instance.lang = language === "en" ? "en-IN" : "hi-IN";
    instance.continuous = continuous;
    instance.interimResults = !continuous;
    instance.maxAlternatives = 3;
    instance.onresult = (event) => {
      let transcript = "";
      let final = false;
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        transcript += result?.[0]?.transcript ?? "";
        final ||= Boolean(result?.isFinal);
      }
      if (!final || !transcript.trim()) return;
      onState("transcribing");
      queueMicrotask(async () => {
        onState("resolving");
        const result = await resolveCommand(transcript);
        onResolved(transcript.trim(), result.intent, result.alternatives);
        if (handsFreeRef.current && !speaking.current) onState("armed");
      });
    };
    instance.onerror = (event) => {
      // "no-speech" is routine in hands-free mode; onend handles the restart.
      if (event.error !== "no-speech" && event.error !== "aborted") onState("error");
    };
    instance.onend = () => {
      if (handsFreeRef.current && !speaking.current && !disabled) {
        // The browser regularly ends long sessions; re-arm quietly for true hands-free.
        restartTimer.current = window.setTimeout(() => {
          if (handsFreeRef.current && !speaking.current) beginRecognition(true);
        }, 250);
        return;
      }
      if (!speaking.current) onState("armed");
    };
    try {
      instance.start();
      onState("capturing");
    } catch {
      onState("error");
    }
  }, [disabled, language, onResolved, onState]);

  const start = useCallback(() => {
    window.speechSynthesis?.cancel();
    beginRecognition(false);
  }, [beginRecognition]);

  const stop = useCallback(() => {
    try {
      recognition.current?.stop();
      onState("transcribing");
    } catch {
      onState("armed");
    }
  }, [onState]);

  const startHandsFree = useCallback(() => {
    handsFreeRef.current = true;
    setHandsFree(true);
    window.speechSynthesis?.cancel();
    beginRecognition(true);
  }, [beginRecognition]);

  const stopHandsFree = useCallback(() => {
    handsFreeRef.current = false;
    setHandsFree(false);
    window.clearTimeout(restartTimer.current);
    recognition.current?.abort();
    onState("idle");
  }, [onState]);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window) || disabled) return;
    recognition.current?.abort();
    speaking.current = true;
    onState("speaking");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "en" ? "en-IN" : "hi-IN";
    utterance.rate = 0.93;
    utterance.pitch = 0.96;
    const done = () => {
      speaking.current = false;
      if (handsFreeRef.current) {
        // Mic stays off while speaking (no self-triggering), then re-arms.
        restartTimer.current = window.setTimeout(() => {
          if (handsFreeRef.current) beginRecognition(true);
        }, 200);
      } else {
        onState("armed");
      }
    };
    utterance.onend = done;
    utterance.onerror = done;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [beginRecognition, disabled, language, onState]);

  return { start, stop, speak, supported, handsFree, startHandsFree, stopHandsFree };
}
