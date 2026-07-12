import { parseBilingualNumbers } from "../numbers/parser.js";
import { DEFAULT_INTENT_EXEMPLARS } from "./exemplars.js";
import { HashingSentenceEmbedder, type SentenceEmbedder } from "./embedder.js";
import { normalizeTranscript } from "./normalize.js";
import {
  INTENTS,
  type Intent,
  type IntentCandidate,
  type IntentExemplar,
  type IntentResolution
} from "./types.js";

interface PreparedExemplar extends IntentExemplar {
  vector: Float32Array;
}

export interface IntentClassifierOptions {
  embedder?: SentenceEmbedder;
  exemplars?: readonly IntentExemplar[];
  threshold?: number;
  topK?: number;
  onAmbiguous?: (transcript: string, candidates: readonly IntentCandidate[]) => void | Promise<void>;
}

function cosine(left: Float32Array, right: Float32Array): number {
  if (left.length !== right.length) throw new Error("Embedding dimensions do not match");
  let value = 0;
  for (let index = 0; index < left.length; index += 1) {
    value += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return value;
}

/** Semantic nearest-exemplar resolver with an explicit, never-silent ambiguous result. */
export class ExemplarIntentClassifier {
  readonly threshold: number;
  readonly topK: number;
  readonly embedder: SentenceEmbedder;
  readonly exemplars: readonly IntentExemplar[];
  readonly #onAmbiguous: IntentClassifierOptions["onAmbiguous"];
  #prepared: ReadonlyMap<Intent, readonly PreparedExemplar[]> | undefined;

  constructor(options: IntentClassifierOptions = {}) {
    this.embedder = options.embedder ?? new HashingSentenceEmbedder();
    this.exemplars = options.exemplars ?? DEFAULT_INTENT_EXEMPLARS;
    this.threshold = options.threshold ?? 0.62;
    this.topK = options.topK ?? 3;
    this.#onAmbiguous = options.onAmbiguous;
    if (this.threshold < -1 || this.threshold > 1) throw new RangeError("Intent threshold must be between -1 and 1");
    if (this.topK < 1 || this.topK > INTENTS.length) throw new RangeError("topK is outside the intent count");
  }

  async initialize(): Promise<void> {
    if (this.#prepared) return;
    const grouped = new Map<Intent, PreparedExemplar[]>();
    for (const intent of INTENTS) grouped.set(intent, []);

    const normalized = this.exemplars.map((entry) => normalizeTranscript(entry.text));
    const vectors = await this.embedder.embed(normalized);
    if (vectors.length !== this.exemplars.length) throw new Error("Embedder returned the wrong exemplar count");

    for (let index = 0; index < this.exemplars.length; index += 1) {
      const exemplar = this.exemplars[index];
      const vector = vectors[index];
      if (!exemplar || !vector) throw new Error(`Missing prepared exemplar at ${index}`);
      grouped.get(exemplar.intent)?.push({ ...exemplar, vector });
    }
    this.#prepared = grouped;
  }

  async classify(transcript: string): Promise<IntentResolution> {
    const [result] = await this.classifyMany([transcript]);
    if (!result) throw new Error("Classifier returned no result");
    return result;
  }

  async classifyMany(transcripts: readonly string[]): Promise<readonly IntentResolution[]> {
    await this.initialize();
    const normalized = transcripts.map(normalizeTranscript);
    const vectors = await this.embedder.embed(normalized);
    return Promise.all(vectors.map((vector, index) => this.resolveVector(transcripts[index] ?? "", normalized[index] ?? "", vector)));
  }

  private async resolveVector(transcript: string, normalizedTranscript: string, vector: Float32Array): Promise<IntentResolution> {
    if (!this.#prepared) throw new Error("Classifier is not initialized");
    const candidates: IntentCandidate[] = [];

    for (const intent of INTENTS) {
      const exemplars = this.#prepared.get(intent) ?? [];
      let bestScore = -1;
      let closestExemplar = "";
      for (const exemplar of exemplars) {
        const score = cosine(vector, exemplar.vector);
        if (score > bestScore) {
          bestScore = score;
          closestExemplar = exemplar.text;
        }
      }
      candidates.push({ intent, score: bestScore, closestExemplar });
    }

    candidates.sort((left, right) => right.score - left.score);
    const topCandidates = candidates.slice(0, this.topK);
    const best = topCandidates[0];
    const numbers = parseBilingualNumbers(transcript);

    if (best && best.score >= this.threshold && normalizedTranscript.length > 0) {
      return {
        status: "resolved",
        transcript,
        normalizedTranscript,
        intent: best.intent,
        confidence: best.score,
        candidates: topCandidates,
        numbers
      };
    }

    await this.#onAmbiguous?.(transcript, topCandidates);
    return { status: "ambiguous", transcript, normalizedTranscript, candidates: topCandidates, numbers };
  }
}

export function createDefaultIntentClassifier(options: Omit<IntentClassifierOptions, "exemplars"> = {}): ExemplarIntentClassifier {
  return new ExemplarIntentClassifier({ ...options, exemplars: DEFAULT_INTENT_EXEMPLARS });
}
