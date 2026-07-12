import type { AdapterAvailability, ModelLoadProgress, ModelLoadState, OnDeviceAdapter } from "../on-device/types.js";
import { normalizeTranscript } from "./normalize.js";

export interface SentenceEmbedder {
  readonly id: string;
  readonly dimensions: number;
  embed(sentences: readonly string[]): Promise<readonly Float32Array[]>;
}

function hashFeature(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function addFeature(vector: Float32Array, feature: string, weight: number): void {
  const bucket = hashFeature(feature, 2166136261) % vector.length;
  const sign = (hashFeature(feature, 2246822519) & 1) === 0 ? 1 : -1;
  vector[bucket] = (vector[bucket] ?? 0) + sign * weight;
}

function normalizeVector(vector: Float32Array): Float32Array {
  let magnitudeSquared = 0;
  for (const value of vector) magnitudeSquared += value * value;
  const magnitude = Math.sqrt(magnitudeSquared);
  if (magnitude === 0) return vector;
  for (let index = 0; index < vector.length; index += 1) {
    vector[index] = (vector[index] ?? 0) / magnitude;
  }
  return vector;
}

/**
 * Small deterministic embedder used by tests and no-model fallback UX.
 * Production on-device classification should inject MiniLmOnDeviceEmbedder.
 */
export class HashingSentenceEmbedder implements SentenceEmbedder {
  readonly id = "hashing-multilingual-ngram-v1";

  constructor(readonly dimensions = 384) {
    if (dimensions < 128) throw new RangeError("HashingSentenceEmbedder needs at least 128 dimensions");
  }

  async embed(sentences: readonly string[]): Promise<readonly Float32Array[]> {
    return sentences.map((sentence) => {
      const normalized = normalizeTranscript(sentence);
      const vector = new Float32Array(this.dimensions);
      const words = normalized.split(/\s+/u).filter(Boolean);

      for (const word of words) addFeature(vector, `w:${word}`, 2.4);
      for (let index = 0; index < words.length - 1; index += 1) {
        addFeature(vector, `b:${words[index]}_${words[index + 1]}`, 1.6);
      }

      const compact = `^${normalized.replace(/\s+/gu, "_")}$`;
      for (let index = 0; index <= compact.length - 3; index += 1) {
        addFeature(vector, `c:${compact.slice(index, index + 3)}`, 0.38);
      }
      return normalizeVector(vector);
    });
  }
}

export const DEFAULT_MINILM_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

export interface TransformersTensorLike {
  readonly data?: Float32Array | readonly number[];
  readonly dims?: readonly number[];
  tolist?(): readonly (readonly number[])[];
}

export type FeatureExtractionPipeline = (
  texts: readonly string[],
  options: { pooling: "mean"; normalize: true }
) => Promise<TransformersTensorLike>;

export type TransformersPipelineLoader = (
  task: "feature-extraction",
  model: string,
  options: { progress_callback?: (event: Record<string, unknown>) => void }
) => Promise<FeatureExtractionPipeline>;

function tensorRows(tensor: TransformersTensorLike, dimensions: number, count: number): Float32Array[] {
  if (tensor.tolist) {
    return tensor.tolist().map((row) => normalizeVector(Float32Array.from(row)));
  }
  if (!tensor.data) throw new Error("Embedding runtime returned no tensor data");
  const flat = Float32Array.from(tensor.data);
  const inferredDimensions = tensor.dims?.at(-1) ?? dimensions;
  if (inferredDimensions !== dimensions || flat.length !== count * dimensions) {
    throw new Error(`Unexpected embedding shape: expected ${count}x${dimensions}, received ${flat.length} values`);
  }
  return Array.from({ length: count }, (_, rowIndex) => {
    const start = rowIndex * dimensions;
    return normalizeVector(flat.slice(start, start + dimensions));
  });
}

/** Lazy transformers.js adapter; the web app injects import("@huggingface/transformers").pipeline. */
export class MiniLmOnDeviceEmbedder implements SentenceEmbedder, OnDeviceAdapter {
  readonly id: string;
  readonly mode = "on-device" as const;
  readonly dimensions = 384;
  #pipeline: FeatureExtractionPipeline | undefined;
  #loadState: ModelLoadState = "idle";

  constructor(
    private readonly loadPipeline: TransformersPipelineLoader,
    private readonly model = DEFAULT_MINILM_MODEL
  ) {
    this.id = `transformers:${model}`;
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
    if (this.#pipeline) return;
    this.#loadState = "loading";
    try {
      this.#pipeline = await this.loadPipeline("feature-extraction", this.model, {
        progress_callback: (event) => {
          const progress = typeof event.progress === "number" ? event.progress : 0;
          const loaded = typeof event.loaded === "number" ? event.loaded : 0;
          const total = typeof event.total === "number" ? event.total : undefined;
          onProgress?.({
            file: typeof event.file === "string" ? event.file : undefined,
            loaded,
            ...(total === undefined ? {} : { total }),
            progress: progress > 1 ? progress / 100 : progress
          });
        }
      });
      this.#loadState = "ready";
    } catch (error) {
      this.#loadState = "error";
      throw error;
    }
  }

  async embed(sentences: readonly string[]): Promise<readonly Float32Array[]> {
    await this.prepare();
    if (!this.#pipeline) throw new Error("MiniLM pipeline failed to initialize");
    const tensor = await this.#pipeline(sentences.map(normalizeTranscript), { pooling: "mean", normalize: true });
    return tensorRows(tensor, this.dimensions, sentences.length);
  }

  dispose(): void {
    this.#pipeline = undefined;
    this.#loadState = "idle";
  }
}
