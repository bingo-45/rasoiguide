import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { WhistleDetector } from "./whistle-detector";

interface Wav {
  sampleRate: number;
  samples: Float32Array;
}

function decodePcm16Wav(path: string): Wav {
  const bytes = readFileSync(path);
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WAVE");
  const sampleRate = bytes.readUInt32LE(24);
  const dataOffset = bytes.indexOf(Buffer.from("data")) + 8;
  const dataLength = bytes.readUInt32LE(dataOffset - 4);
  const samples = new Float32Array(dataLength / 2);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = bytes.readInt16LE(dataOffset + index * 2) / 32768;
  }
  return { sampleRate, samples };
}

function goertzelPower(samples: Float32Array, offset: number, size: number, sampleRate: number, frequency: number): number {
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const coefficient = 2 * Math.cos(omega);
  let previous = 0;
  let previousTwo = 0;
  for (let index = 0; index < size; index += 1) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (size - 1));
    const sample = (samples[offset + index] ?? 0) * window;
    const current = sample + coefficient * previous - previousTwo;
    previousTwo = previous;
    previous = current;
  }
  return (previousTwo * previousTwo + previous * previous - coefficient * previous * previousTwo) / (size * size);
}

function replay(path: string): number {
  const wav = decodePcm16Wav(path);
  const detector = new WhistleDetector();
  const fftSize = 2048;
  let events = 0;
  for (let offset = 0; offset + fftSize <= wav.samples.length; offset += fftSize) {
    let power = 0;
    let bins = 0;
    for (let frequency = 1_520; frequency <= 3_920; frequency += 120) {
      power += goertzelPower(wav.samples, offset, fftSize, wav.sampleRate, frequency);
      bins += 1;
    }
    const bandEnergyDb = 10 * Math.log10(power / bins + 1e-15);
    const timestampMs = ((offset + fftSize) / wav.sampleRate) * 1_000;
    if (detector.processFrame({ timestampMs, bandEnergyDb }).event) events += 1;
  }
  return events;
}

const fixture = (name: string) => resolve(process.cwd(), "fixtures", "audio", name);

describe("committed WAV fixtures", () => {
  it.each([
    ["single-whistle.wav", 1],
    ["three-whistles.wav", 3],
    ["exhaust-fan-only.wav", 0],
    ["mixer-grinder-only.wav", 0]
  ] as const)("detects the exact safe count in %s", (name, expected) => {
    expect(replay(fixture(name))).toBe(expected);
  });
});
