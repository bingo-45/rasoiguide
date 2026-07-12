import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import { voiceMachine, voiceVisualState } from "./voiceMachine.js";

const candidates = [
  { intent: "advance" as const, score: 0.91, closestExemplar: "agla step" },
  { intent: "repeat" as const, score: 0.32, closestExemplar: "dobara batao" },
  { intent: "timer-query" as const, score: 0.2, closestExemplar: "time left" }
];

describe("voiceMachine", () => {
  it("follows the half-duplex happy path and mutes the mic only while speaking", () => {
    const actor = createActor(voiceMachine, { input: { locale: "hinglish", mode: "web-speech" } }).start();
    actor.send({ type: "ARM" });
    actor.send({ type: "SPEECH_START" });
    actor.send({ type: "CAPTURE_COMPLETE" });
    actor.send({ type: "TRANSCRIPT_READY", transcript: "agla step" });
    actor.send({ type: "INTENT_RESOLVED", intent: "advance", candidates });
    expect(actor.getSnapshot().value).toBe("executing");
    actor.send({ type: "EXECUTION_COMPLETE", shouldSpeak: true });
    expect(actor.getSnapshot().value).toBe("speaking");
    expect(actor.getSnapshot().context.micMuted).toBe(true);
    actor.send({ type: "TTS_DONE" });
    expect(actor.getSnapshot().value).toBe("armed");
    expect(actor.getSnapshot().context.micMuted).toBe(false);
  });

  it("routes sub-threshold results through confirmation", () => {
    const actor = createActor(voiceMachine, { input: undefined }).start();
    actor.send({ type: "ARM" });
    actor.send({ type: "SPEECH_START" });
    actor.send({ type: "CAPTURE_COMPLETE" });
    actor.send({ type: "TRANSCRIPT_READY", transcript: "hmm" });
    actor.send({ type: "INTENT_AMBIGUOUS", candidates });
    expect(actor.getSnapshot().value).toBe("confirming");
    actor.send({ type: "CHOOSE_INTENT", intent: "repeat" });
    expect(actor.getSnapshot().value).toBe("executing");
    expect(actor.getSnapshot().context.resolvedIntent).toBe("repeat");
  });

  it("degrades calmly to touch when microphone permission is denied", () => {
    const actor = createActor(voiceMachine, { input: undefined }).start();
    actor.send({ type: "ARM" });
    actor.send({ type: "MIC_DENIED" });
    expect(actor.getSnapshot().value).toBe("error");
    expect(actor.getSnapshot().context.mode).toBe("touch");
    expect(voiceVisualState(actor.getSnapshot().value)).toBe("error");
    actor.send({ type: "USE_TOUCH" });
    expect(actor.getSnapshot().value).toBe("idle");
  });

  it("supports stop-only barge-in during TTS", () => {
    const actor = createActor(voiceMachine, { input: undefined }).start();
    actor.send({ type: "ARM" });
    actor.send({ type: "SPEECH_START" });
    actor.send({ type: "CAPTURE_COMPLETE" });
    actor.send({ type: "TRANSCRIPT_READY", transcript: "next" });
    actor.send({ type: "INTENT_RESOLVED", intent: "advance", candidates });
    actor.send({ type: "EXECUTION_COMPLETE", shouldSpeak: true });
    actor.send({ type: "BARGE_IN_STOP" });
    expect(actor.getSnapshot().value).toBe("armed");
    expect(actor.getSnapshot().context.micMuted).toBe(false);
  });
});
