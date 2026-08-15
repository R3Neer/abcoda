import { describe, expect, it, vi } from "vitest";
import type ABCJS from "abcjs";
import {
  AbcjsPlaybackEngine,
  type AbcjsSynthController,
} from "../../apps/widget/src/adapters/abcjs/abcjs-playback-engine";

function setup() {
  const calls: string[] = [];
  let started = false;

  const pause = vi.fn(() => {
    calls.push("pause");
  });

  const play = vi.fn(() => {
    started = !started;
    calls.push(
      started
        ? "play:start"
        : "play:pause",
    );

    // This models abcjs._play(): when its toggle goes false,
    // it invokes pause(), but pause itself does not change
    // isStarted.
    if (!started) {
      pause();
    }

    return Promise.resolve();
  });

  const setTune = vi.fn(
    (
      _tune: ABCJS.TuneObject,
      userAction: boolean,
    ) => {
      calls.push(`setTune:${userAction}`);
      started = false;

      return Promise.resolve({
        status: userAction
          ? "created" as const
          : "no-audio-context" as const,
      });
    },
  );

  const spies = {
    setTune,
    play,
    pause,
    restart: vi.fn(),
    seek: vi.fn((progress: number) => {
      calls.push(`seek:${progress}`);
    }),
    setProgress: vi.fn((progress: number) => {
      calls.push(`progress:${progress}`);
    }),
    toggleLoop: vi.fn(() => {
      calls.push("loop");
    }),
    setWarp: vi.fn((percent: number) => {
      calls.push(`warp:${percent}`);
      return Promise.resolve();
    }),
  };

  const synth: AbcjsSynthController = {
    ...spies,
    get isStarted() {
      return started;
    },
  };

  const ensureAudio = vi.fn(() => {
    calls.push("audio:running");
    return Promise.resolve();
  });

  const engine = new AbcjsPlaybackEngine(
    synth,
    {} as ABCJS.TuneObject,
    { qpm: 96 },
    ensureAudio,
  );

  return {
    calls,
    engine,
    spies,
    synth,
    isStarted: () => started,
  };
}

describe("AbcjsPlaybackEngine", () => {
  it("preflights without creating Web Audio and primes inside Play", async () => {
    const { calls, engine } = setup();

    await engine.initialize();
    engine.setLoop(true);
    await engine.setTempoRatio(1.25);
    engine.seek(0.4);

    expect(calls).toEqual([
      "setTune:false",
    ]);

    await engine.play();

    expect(calls).toEqual([
      "setTune:false",
      "audio:running",
      "setTune:true",
      "loop",
      "warp:125",
      "progress:0.4",
      "seek:0.4",
      "play:start",
      "audio:running",
    ]);
  });

  it("adapts abcjs toggle semantics into explicit play pause and resume", async () => {
    const {
      engine,
      spies,
      isStarted,
    } = setup();

    await engine.initialize();

    await engine.play();
    expect(isStarted()).toBe(true);

    await engine.pause();
    expect(isStarted()).toBe(false);

    engine.setLoop(true);
    await engine.setTempoRatio(0.75);

    // Changing loop or tempo while paused must not restart audio.
    expect(isStarted()).toBe(false);

    await engine.play();
    expect(isStarted()).toBe(true);

    // start, toggle-to-pause, start again
    expect(spies.play).toHaveBeenCalledTimes(3);
    expect(spies.pause).toHaveBeenCalledOnce();
    expect(spies.toggleLoop).toHaveBeenCalledOnce();
    expect(spies.setWarp).toHaveBeenCalledWith(75);
  });

  it("keeps manual seek paused and resumes from the selected progress", async () => {
    const {
      engine,
      spies,
      isStarted,
    } = setup();

    await engine.initialize();
    await engine.play();
    await engine.pause();

    engine.seek(0.6);

    expect(isStarted()).toBe(false);
    expect(spies.setProgress).toHaveBeenLastCalledWith(0.6);
    expect(spies.seek).toHaveBeenLastCalledWith(
      0.6,
      "percent",
    );

    await engine.play();

    expect(isStarted()).toBe(true);
  });

  it("lets a seek made during an async tempo rebuild win", async () => {
    const {
      engine,
      spies,
      synth,
    } = setup();

    await engine.initialize();
    await engine.play();

    synth.percent = 0.4;

    let release!: () => void;

    spies.setWarp.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );

    const changingTempo =
      engine.setTempoRatio(0.8);

    engine.seek(0.72);

    expect(engine.progress()).toBe(0.72);

    release();
    await changingTempo;

    expect(spies.setProgress).toHaveBeenLastCalledWith(0.72);
    expect(spies.seek).toHaveBeenLastCalledWith(
      0.72,
      "percent",
    );
  });

  it("stops an async tempo rebuild that finishes after disposal", async () => {
    const {
      engine,
      spies,
    } = setup();

    await engine.initialize();
    await engine.play();

    let release!: () => void;

    spies.setWarp.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );

    const changingTempo =
      engine.setTempoRatio(0.8);

    await engine.dispose();

    const pausesAfterDispose =
      spies.pause.mock.calls.length;

    release();
    await changingTempo;

    expect(spies.pause.mock.calls.length)
      .toBe(pausesAfterDispose + 1);
  });

  it("rejects a blocked audio context before starting the synth", async () => {
    const {
      engine,
      spies,
    } = setup();

    const blocked = new AbcjsPlaybackEngine(
      { ...spies },
      {} as ABCJS.TuneObject,
      { qpm: 96 },
      () => Promise.reject(
        new Error("Audio is blocked"),
      ),
    );

    await blocked.initialize();

    await expect(
      blocked.play(),
    ).rejects.toThrow(
      "Audio is blocked",
    );

    expect(spies.play).not.toHaveBeenCalled();
    expect(engine.progress()).toBe(0);
  });
});