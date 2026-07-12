import { LocalStorageWhistleCalibrationStore, WhistleDetector, configureWhistleAnalyser, readBandEnergyFrame } from "@rasoiguide/audio-dsp";
import { useCallback, useEffect, useRef, useState } from "react";

export type WhistleDetectorStatus = "off" | "requesting" | "warming" | "listening" | "whistle" | "error";

export function useWhistleController(onWhistle: () => void) {
  const [status, setStatus] = useState<WhistleDetectorStatus>("off");
  const stream = useRef<MediaStream>();
  const context = useRef<AudioContext>();
  const interval = useRef<number>();
  const callback = useRef(onWhistle);
  callback.current = onWhistle;

  const stop = useCallback(() => {
    if (interval.current) window.clearInterval(interval.current);
    interval.current = undefined;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = undefined;
    void context.current?.close();
    context.current = undefined;
    setStatus("off");
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      return;
    }
    stop();
    setStatus("requesting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false },
        video: false
      });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(media);
      const analyser = audioContext.createAnalyser();
      configureWhistleAnalyser(analyser);
      analyser.smoothingTimeConstant = 0.12;
      source.connect(analyser);
      const calibrationStore = new LocalStorageWhistleCalibrationStore(localStorage);
      const detector = new WhistleDetector({ calibrationStore, userId: "kitchen-primary" });
      stream.current = media;
      context.current = audioContext;
      const startedAt = performance.now();
      setStatus("warming");
      interval.current = window.setInterval(() => {
        const raw = readBandEnergyFrame(analyser, audioContext.sampleRate, performance.now() - startedAt);
        const frame = { ...raw, bandEnergyDb: Number.isFinite(raw.bandEnergyDb) ? raw.bandEnergyDb : -120 };
        const result = detector.processFrame(frame);
        if (result.event) {
          setStatus("whistle");
          callback.current();
          window.setTimeout(() => setStatus("listening"), 900);
        } else if (result.state === "warming") setStatus("warming");
        else setStatus("listening");
      }, 46);
    } catch {
      setStatus("error");
    }
  }, [stop]);

  return { status, start, stop };
}
