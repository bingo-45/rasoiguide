import type { BandEnergyFrame } from "./types";

export const WHISTLE_FFT_SIZE = 2048 as const;
export const WHISTLE_BAND_LOW_HZ = 1_500;
export const WHISTLE_BAND_HIGH_HZ = 4_000;

/** Expected analyser frame duration; about 46 ms at the common 44.1 kHz rate. */
export function analyserFrameDurationMs(
  sampleRate: number,
  fftSize = WHISTLE_FFT_SIZE,
): number {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError("Sample rate must be greater than zero");
  }
  return (fftSize / sampleRate) * 1_000;
}

/**
 * Converts AnalyserNode dBFS bins into mean power in the whistle band.
 * Averaging happens in linear power space; averaging dB values directly would
 * understate narrow, high-energy cooker harmonics.
 */
export function bandEnergyDbFromSpectrum(
  spectrumDb: ArrayLike<number>,
  sampleRate: number,
  fftSize = WHISTLE_FFT_SIZE,
  bandLowHz = WHISTLE_BAND_LOW_HZ,
  bandHighHz = WHISTLE_BAND_HIGH_HZ,
): number {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError("Sample rate must be greater than zero");
  }
  if (!Number.isInteger(fftSize) || fftSize <= 0) {
    throw new RangeError("FFT size must be a positive integer");
  }
  if (!(bandLowHz >= 0 && bandHighHz > bandLowHz && bandHighHz <= sampleRate / 2)) {
    throw new RangeError("Whistle band must fit inside the Nyquist range");
  }

  const binWidthHz = sampleRate / fftSize;
  const firstBin = Math.max(0, Math.ceil(bandLowHz / binWidthHz));
  const lastBin = Math.min(spectrumDb.length - 1, Math.floor(bandHighHz / binWidthHz));
  if (lastBin < firstBin) {
    throw new RangeError("Spectrum does not contain the configured whistle band");
  }

  let powerSum = 0;
  let count = 0;
  for (let bin = firstBin; bin <= lastBin; bin += 1) {
    const db = spectrumDb[bin]!;
    if (Number.isNaN(db)) {
      throw new TypeError("Spectrum contains NaN");
    }
    powerSum += db === Number.NEGATIVE_INFINITY ? 0 : 10 ** (db / 10);
    count += 1;
  }
  if (powerSum === 0) return Number.NEGATIVE_INFINITY;
  return 10 * Math.log10(powerSum / count);
}

export interface FrequencyAnalyserLike {
  fftSize: number;
  readonly frequencyBinCount: number;
  getFloatFrequencyData(array: Float32Array): void;
}

/** Configures the exact analyser shape required by the detector. */
export function configureWhistleAnalyser(analyser: FrequencyAnalyserLike): void {
  analyser.fftSize = WHISTLE_FFT_SIZE;
}

/** Reads one timestamped 1.5-4 kHz energy frame from an AnalyserNode-like object. */
export function readBandEnergyFrame(
  analyser: FrequencyAnalyserLike,
  sampleRate: number,
  timestampMs: number,
): BandEnergyFrame {
  if (analyser.fftSize !== WHISTLE_FFT_SIZE) {
    throw new RangeError(`Whistle analyser fftSize must be ${WHISTLE_FFT_SIZE}`);
  }
  const spectrum = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(spectrum);
  return {
    timestampMs,
    bandEnergyDb: bandEnergyDbFromSpectrum(spectrum, sampleRate, analyser.fftSize),
  };
}
