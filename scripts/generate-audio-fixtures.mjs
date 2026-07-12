import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sampleRate = 44_100;

function wavBuffer(samples) {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index] ?? 0));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  return buffer;
}

let randomState = 0x5eed1234;
function noise() {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return ((randomState >>> 0) / 0xffffffff) * 2 - 1;
}

function render(durationSec, sampleAt) {
  const length = Math.round(durationSec * sampleRate);
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index += 1) samples[index] = sampleAt(index / sampleRate, index);
  return samples;
}

function whistleEnvelope(time, start, duration = 1.15) {
  const position = time - start;
  if (position < 0 || position > duration) return 0;
  const attack = Math.min(1, position / 0.12);
  const release = Math.min(1, (duration - position) / 0.18);
  return Math.sin(Math.min(attack, release) * Math.PI * 0.5);
}

function cookerWhistle(time, start) {
  const envelope = whistleEnvelope(time, start);
  if (!envelope) return 0;
  const wobble = 1 + 0.025 * Math.sin(2 * Math.PI * 5.2 * (time - start));
  return envelope * (
    0.62 * Math.sin(2 * Math.PI * 2_180 * wobble * time) +
    0.25 * Math.sin(2 * Math.PI * 3_270 * time) +
    0.09 * Math.sin(2 * Math.PI * 1_620 * time)
  );
}

function ambient(time) {
  return 0.006 * noise() + 0.004 * Math.sin(2 * Math.PI * 110 * time);
}

const fixtures = {
  "single-whistle.wav": render(5.5, (time) => ambient(time) + cookerWhistle(time, 2)),
  "three-whistles.wav": render(24.5, (time) => ambient(time) + cookerWhistle(time, 2) + cookerWhistle(time, 11.4) + cookerWhistle(time, 20.8)),
  "exhaust-fan-only.wav": render(12, (time) => 0.095 * Math.sin(2 * Math.PI * 92 * time) + 0.035 * Math.sin(2 * Math.PI * 184 * time) + 0.018 * noise()),
  "mixer-grinder-only.wav": render(12, (time) => {
    const ramp = Math.min(1, time / 0.6, (12 - time) / 0.6);
    return ramp * (0.16 * Math.sin(2 * Math.PI * 730 * time) + 0.07 * Math.sin(2 * Math.PI * 1_460 * time) + 0.035 * Math.sin(2 * Math.PI * 2_920 * time) + 0.025 * noise());
  })
};

for (const [name, samples] of Object.entries(fixtures)) {
  const path = resolve(root, "fixtures", "audio", name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, wavBuffer(samples));
}

const bell = render(2.2, (time) => {
  const strike = Math.min(1, time / 0.006);
  const decay = Math.exp(-2.55 * time);
  return strike * decay * (
    0.48 * Math.sin(2 * Math.PI * 612 * time) +
    0.24 * Math.sin(2 * Math.PI * 1_043 * time + 0.4) +
    0.16 * Math.sin(2 * Math.PI * 1_487 * time + 1.1) +
    0.08 * Math.sin(2 * Math.PI * 2_376 * time + 0.7)
  );
});
const bellPath = resolve(root, "apps", "web", "public", "audio", "brass-bell.wav");
mkdirSync(dirname(bellPath), { recursive: true });
writeFileSync(bellPath, wavBuffer(bell));

console.log(`Generated ${Object.keys(fixtures).length} DSP fixtures and the original brass-bell cue at ${sampleRate} Hz.`);
