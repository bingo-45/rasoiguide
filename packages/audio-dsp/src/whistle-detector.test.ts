import { describe, expect, it } from "vitest";

import {
  analyserFrameDurationMs,
  bandEnergyDbFromSpectrum,
  LocalStorageWhistleCalibrationStore,
  readBandEnergyFrame,
  WhistleDetector,
} from "./index";
import type {
  WhistleCalibrationRecord,
  WhistleCalibrationStore,
  WhistleEvent,
} from "./index";

function feed(
  detector: WhistleDetector,
  fromMs: number,
  throughMs: number,
  energyDb: number,
  intervalMs = 100,
): WhistleEvent[] {
  const events: WhistleEvent[] = [];
  for (let timestampMs = fromMs; timestampMs <= throughMs; timestampMs += intervalMs) {
    const event = detector.processFrame({ timestampMs, bandEnergyDb: energyDb }).event;
    if (event !== undefined) events.push(event);
  }
  return events;
}

function warm(detector: WhistleDetector, energyDb = -50): void {
  feed(detector, 0, 1_000, energyDb);
  expect(detector.snapshot().state).toBe("idle");
}

class MemoryCalibrationStore implements WhistleCalibrationStore {
  public readonly records = new Map<string, WhistleCalibrationRecord>();

  public load(userId: string): WhistleCalibrationRecord | undefined {
    return this.records.get(userId);
  }

  public save(userId: string, record: WhistleCalibrationRecord): void {
    this.records.set(userId, record);
  }
}

describe("WhistleDetector", () => {
  it("emits exactly one event after a valid 0.6-3.5 second burst falls", () => {
    const detector = new WhistleDetector();
    warm(detector);

    expect(feed(detector, 1_100, 1_800, -30)).toEqual([]);
    expect(detector.snapshot()).toMatchObject({
      state: "candidate",
      candidateStartedAtMs: 1_100,
      shouldSuspendStt: true,
    });

    const result = detector.processFrame({ timestampMs: 1_900, bandEnergyDb: -50 });
    expect(result.event).toMatchObject({
      type: "whistle",
      startedAtMs: 1_100,
      endedAtMs: 1_900,
      durationMs: 800,
      peakDeltaDb: 20,
      effectiveEnterThresholdDb: 18,
      requiresCalibrationConfirmation: true,
    });
    expect(result.state).toBe("refractory");
    expect(result.shouldSuspendStt).toBe(false);
    expect(detector.snapshot().detectedCount).toBe(1);
  });

  it("counts a three-whistle sequence with the exact eight-second refractory gate", () => {
    const detector = new WhistleDetector();
    warm(detector);
    const events: WhistleEvent[] = [];

    events.push(...feed(detector, 1_100, 1_800, -30));
    events.push(...feed(detector, 1_900, 1_900, -50));
    feed(detector, 2_000, 9_900, -50);

    events.push(...feed(detector, 10_000, 10_700, -30));
    events.push(...feed(detector, 10_800, 10_800, -50));
    feed(detector, 10_900, 18_800, -50);

    events.push(...feed(detector, 18_900, 19_600, -30));
    events.push(...feed(detector, 19_700, 19_700, -50));

    expect(events.map((event) => event.endedAtMs)).toEqual([1_900, 10_800, 19_700]);
    expect(detector.snapshot().detectedCount).toBe(3);
  });

  it("ignores a whistle-like burst that starts during refractory", () => {
    const detector = new WhistleDetector();
    warm(detector);
    feed(detector, 1_100, 1_800, -30);
    const first = detector.processFrame({ timestampMs: 1_900, bandEnergyDb: -50 });
    expect(first.event).toBeDefined();

    expect(feed(detector, 5_000, 5_900, -30)).toEqual([]);
    expect(detector.processFrame({ timestampMs: 6_000, bandEnergyDb: -50 }).event).toBeUndefined();
    feed(detector, 6_100, 9_900, -50);
    expect(detector.snapshot().state).toBe("idle");
    expect(detector.snapshot().detectedCount).toBe(1);
  });

  it("rejects exhaust ambience, short transients, and mixer-length sustained noise", () => {
    const exhaust = new WhistleDetector();
    warm(exhaust, -45);
    expect(feed(exhaust, 1_100, 15_000, -45)).toEqual([]);

    const transient = new WhistleDetector();
    warm(transient);
    expect(feed(transient, 1_100, 1_500, -30)).toEqual([]);
    expect(transient.processFrame({ timestampMs: 1_600, bandEnergyDb: -50 }).event).toBeUndefined();
    expect(transient.snapshot().state).toBe("idle");

    const mixer = new WhistleDetector();
    warm(mixer);
    expect(feed(mixer, 1_100, 4_700, -25)).toEqual([]);
    expect(mixer.snapshot().state).toBe("rejecting");
    expect(mixer.processFrame({ timestampMs: 4_800, bandEnergyDb: -50 }).event).toBeUndefined();
    expect(mixer.snapshot()).toMatchObject({ state: "idle", detectedCount: 0 });
  });

  it.each([
    { durationMs: 600, detected: true },
    { durationMs: 599, detected: false },
    { durationMs: 3_500, detected: true },
    { durationMs: 3_501, detected: false },
  ])(
    "enforces the inclusive 0.6-3.5 second duration window at $durationMs ms",
    ({ durationMs, detected }) => {
      const detector = new WhistleDetector();
      warm(detector);
      detector.processFrame({ timestampMs: 1_100, bandEnergyDb: -30 });
      const result = detector.processFrame({
        timestampMs: 1_100 + durationMs,
        bandEnergyDb: -50,
      });
      expect(result.event !== undefined).toBe(detected);
    },
  );

  it("uses hysteresis: an entered candidate survives below 18 dB until it falls below 12 dB", () => {
    const detector = new WhistleDetector();
    warm(detector);
    detector.processFrame({ timestampMs: 1_100, bandEnergyDb: -31 }); // +19 dB enters
    feed(detector, 1_200, 1_800, -37); // +13 dB stays in the candidate
    const result = detector.processFrame({ timestampMs: 1_900, bandEnergyDb: -39 }); // +11 exits

    expect(result.event?.durationMs).toBe(800);
    expect(result.event?.peakDeltaDb).toBe(19);
  });

  it("ages ambient samples on the rolling ten-second window", () => {
    const detector = new WhistleDetector();
    warm(detector, -50);
    feed(detector, 1_100, 12_000, -45);

    const snapshot = detector.snapshot();
    expect(snapshot.ambientMedianDb).toBe(-45);
    expect(snapshot.ambientSampleCount).toBeLessThanOrEqual(101);
  });

  it("loads and persists per-user calibration as a linear power multiplier", () => {
    const store = new MemoryCalibrationStore();
    store.records.set("kitchen-a", { multiplier: 2, confirmedAtMs: 10 });
    const calibrated = new WhistleDetector({ calibrationStore: store, userId: "kitchen-a" });
    warm(calibrated);

    expect(calibrated.effectiveEnterThresholdDb).toBeCloseTo(21.0103, 4);
    calibrated.processFrame({ timestampMs: 1_100, bandEnergyDb: -30 }); // +20 dB: below calibrated gate
    expect(calibrated.snapshot().state).toBe("idle");
    calibrated.processFrame({ timestampMs: 1_200, bandEnergyDb: -28 });
    feed(calibrated, 1_300, 1_800, -28);
    const confirmedEvent = calibrated.processFrame({ timestampMs: 1_900, bandEnergyDb: -50 });
    expect(confirmedEvent.event?.requiresCalibrationConfirmation).toBe(false);

    const fresh = new WhistleDetector({ calibrationStore: store, userId: "kitchen-b" });
    const record = fresh.confirmCalibration(0.5, 1234);
    expect(record).toEqual({ multiplier: 0.5, confirmedAtMs: 1234 });
    expect(store.records.get("kitchen-b")).toEqual(record);
    expect(fresh.effectiveEnterThresholdDb).toBeCloseTo(14.9897, 4);
  });

  it("rejects non-monotonic and non-finite frames", () => {
    const detector = new WhistleDetector();
    detector.processFrame({ timestampMs: 0, bandEnergyDb: -50 });
    expect(() => detector.processFrame({ timestampMs: 0, bandEnergyDb: -50 })).toThrow(
      /increase monotonically/,
    );
    expect(() =>
      new WhistleDetector().processFrame({ timestampMs: 0, bandEnergyDb: Number.NaN }),
    ).toThrow(/finite/);
  });
});

describe("spectrum helpers", () => {
  it("uses the exact 2048-sample analyser window (~46 ms at 44.1 kHz)", () => {
    expect(analyserFrameDurationMs(44_100)).toBeCloseTo(46.44, 2);
  });

  it("computes band energy in linear power space across 1.5-4 kHz", () => {
    const sampleRate = 48_000;
    const spectrum = new Float32Array(1_024).fill(-100);
    const binWidth = sampleRate / 2_048;
    for (
      let bin = Math.ceil(1_500 / binWidth);
      bin <= Math.floor(4_000 / binWidth);
      bin += 1
    ) {
      spectrum[bin] = -40;
    }

    expect(bandEnergyDbFromSpectrum(spectrum, sampleRate)).toBeCloseTo(-40, 5);
  });

  it("reads a frame from an AnalyserNode-like source", () => {
    const analyser = {
      fftSize: 2_048,
      frequencyBinCount: 1_024,
      getFloatFrequencyData(array: Float32Array) {
        array.fill(-55);
      },
    };

    const frame = readBandEnergyFrame(analyser, 48_000, 25);
    expect(frame.timestampMs).toBe(25);
    expect(frame.bandEnergyDb).toBeCloseTo(-55, 10);
  });

  it("tolerates corrupt localStorage calibration records without leaving local mode", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
    };
    const store = new LocalStorageWhistleCalibrationStore(storage);
    values.set("rasoiguide:whistle-calibration:default", "not json");
    expect(store.load("default")).toBeUndefined();
    store.save("default", { multiplier: 1.25, confirmedAtMs: 42 });
    expect(store.load("default")).toEqual({ multiplier: 1.25, confirmedAtMs: 42 });
  });
});
