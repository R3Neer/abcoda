import { describe, expect, it, vi } from "vitest";
import type ABCJS from "abcjs";
import {
  AbcjsPlaybackEngine,
  type AbcjsSynthController,
} from "../../apps/widget/src/adapters/abcjs/abcjs-playback-engine";

function setup() {
  const calls: string[] = [];
  const spies = {
    setTune: vi.fn((_tune: ABCJS.TuneObject, userAction: boolean) => {
      calls.push(`setTune:${userAction}`);
      return Promise.resolve({ status: userAction ? "created" as const : "no-audio-context" as const });
    }),
    play: vi.fn(() => { calls.push("play"); return Promise.resolve(); }),
    pause: vi.fn(() => { calls.push("pause"); }),
    restart: vi.fn(),
    seek: vi.fn((progress: number) => { calls.push(`seek:${progress}`); }),
    setProgress: vi.fn((progress: number) => { calls.push(`progress:${progress}`); }),
    toggleLoop: vi.fn(() => { calls.push("loop"); }),
    setWarp: vi.fn((percent: number) => { calls.push(`warp:${percent}`); return Promise.resolve(); }),
  };
  const synth: AbcjsSynthController = { ...spies };
  const ensureAudio = vi.fn(() => { calls.push("audio:running"); return Promise.resolve(); });
  const engine = new AbcjsPlaybackEngine(
    synth,
    {} as ABCJS.TuneObject,
    { qpm: 96 },
    ensureAudio,
  );
  return { calls, engine, spies, synth };
}

describe("AbcjsPlaybackEngine", () => {
  it("preflights without creating Web Audio and primes inside Play", async () => {
    const { calls, engine } = setup();
    await engine.initialize();
    engine.setLoop(true);
    await engine.setTempoRatio(1.25);
    engine.seek(0.4);

    expect(calls).toEqual(["setTune:false"]);
    await engine.play();
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

  it("uses explicit pause and applies later preferences live", async () => {
    const { engine, spies } = setup();
    await engine.initialize();
    await engine.play();
    await engine.pause();
    engine.setLoop(true);
    await engine.setTempoRatio(0.75);

    expect(spies.pause).toHaveBeenCalledOnce();
    expect(spies.toggleLoop).toHaveBeenCalledOnce();
    expect(spies.setWarp).toHaveBeenCalledWith(75);
  });

  it("rejects a blocked audio context before starting the synth", async () => {
    const { engine, spies } = setup();
    const blocked = new AbcjsPlaybackEngine(
      { ...spies },
      {} as ABCJS.TuneObject,
      { qpm: 96 },
      () => Promise.reject(new Error("Audio is blocked")),
    );
    await blocked.initialize();

    await expect(blocked.play()).rejects.toThrow("Audio is blocked");
    expect(spies.play).not.toHaveBeenCalled();
    expect(engine.progress()).toBe(0);
  });
});
