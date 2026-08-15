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
    seek: vi.fn((progress) => { calls.push(`seek:${progress}`); }),
    setProgress: vi.fn((progress) => { calls.push(`progress:${progress}`); }),
    toggleLoop: vi.fn(() => { calls.push("loop"); }),
    setWarp: vi.fn(async (warp) => { calls.push(`warp:${warp}`); }),
  };
  const ensureAudio = vi.fn(async () => { calls.push("audio:running"); });
  const backend = new DeferredAudioBackend(synth, ensureAudio);
  const tune = {} as ABCJS.TuneObject;
  const options = { qpm: 96 } as ABCJS.SynthOptions;
  return { backend, calls, ensureAudio, options, synth, tune };
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
      "audio:running",
      "setTune:true",
      "loop",
      "warp:125",
      "progress:0.4",
      "seek:0.4",
      "play",
      "audio:running",
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

  it("reads abcjs's live progress before rebuilding audio", async () => {
    const { backend, synth } = setup();
    synth.percent = .625;
    expect(backend.getProgress()).toBe(.625);
    synth.percent = 2;
    expect(backend.getProgress()).toBe(1);
  });

  it("seeks the audio buffer as well as the cursor after rebuilding the tune", async () => {
    let displayedProgress = 0;
    let audioProgress = 0;
    const { backend, synth, tune, options } = setup();
    vi.mocked(synth.setProgress).mockImplementation((progress) => {
      displayedProgress = progress;
    });
    vi.mocked(synth.seek).mockImplementation((progress) => {
      audioProgress = progress;
    });

    await backend.configure(tune, options);
    await backend.play();
    synth.percent = .625;
    await backend.configure(tune, { ...options, program: 40 });
    backend.setProgress(.625);
    await backend.play();

    expect(displayedProgress).toBe(.625);
    expect(audioProgress).toBe(.625);
    expect(synth.seek).toHaveBeenLastCalledWith(.625, "percent");
  });

  it("does not start abcjs when the host keeps Web Audio blocked", async () => {
    const { backend, synth, tune, options } = setup();
    const blocked = new DeferredAudioBackend(synth, async () => {
      throw new Error("Audio is blocked");
    });
    await blocked.configure(tune, options);

    await expect(blocked.play()).rejects.toThrow("Audio is blocked");
    expect(synth.play).not.toHaveBeenCalled();
  });
});
