import { describe, expect, it, vi } from "vitest";
import type ABCJS from "abcjs";
import { DeferredAudioBackend, type SynthControllerLike } from "../web/src/deferred-audio";

function setup() {
  const calls: string[] = [];
  const synth: SynthControllerLike = {
    setTune: vi.fn(async (_tune, userAction) => {
      calls.push(`setTune:${userAction}`);
      return { status: userAction ? "created" as const : "no-audio-context" as const };
    }),
    play: vi.fn(async () => { calls.push("play"); }),
    pause: vi.fn(),
    restart: vi.fn(() => { calls.push("restart"); }),
    setProgress: vi.fn((progress) => { calls.push(`progress:${progress}`); }),
    toggleLoop: vi.fn(() => { calls.push("loop"); }),
    setWarp: vi.fn(async (warp) => { calls.push(`warp:${warp}`); }),
  };
  const backend = new DeferredAudioBackend(synth);
  const tune = {} as ABCJS.TuneObject;
  const options = { qpm: 96 } as ABCJS.SynthOptions;
  return { backend, calls, options, synth, tune };
}

describe("deferred abcjs audio", () => {
  it("does not create audio while the widget mounts", async () => {
    const { backend, calls, synth, tune, options } = setup();
    await backend.configure(tune, options);
    await backend.setWarp(125);
    backend.toggleLoop();
    backend.setProgress(.4);

    expect(calls).toEqual(["setTune:false"]);
    expect(synth.play).not.toHaveBeenCalled();
    expect(synth.setWarp).not.toHaveBeenCalled();
  });

  it("primes audio inside the first Play gesture and restores pending state", async () => {
    const { backend, calls, tune, options } = setup();
    await backend.configure(tune, options);
    await backend.setWarp(125);
    backend.toggleLoop();
    backend.setProgress(.4);
    await backend.play();

    expect(calls).toEqual([
      "setTune:false",
      "setTune:true",
      "loop",
      "warp:125",
      "progress:0.4",
      "play",
    ]);
  });

  it("uses abcjs's play toggle for pause and re-primes after instrument changes", async () => {
    const { backend, calls, tune, options } = setup();
    await backend.configure(tune, options);
    await backend.play();
    await backend.pause();
    await backend.configure(tune, { ...options, qpm: 80 });
    await backend.play();

    expect(calls.filter((call) => call === "setTune:true")).toHaveLength(2);
    expect(calls.filter((call) => call === "play")).toHaveLength(3);
  });
});
