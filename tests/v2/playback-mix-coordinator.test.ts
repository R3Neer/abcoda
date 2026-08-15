import { describe, expect, it, vi } from "vitest";
import {
  PlaybackMixCoordinator,
  type PlaybackReconfigurationPort,
} from "../../apps/widget/src/application/playback-mix-coordinator";
import type { PlaybackEngine } from "../../apps/widget/src/application/playback-session";
import type { VoiceMixSnapshot } from "../../apps/widget/src/application/voice-mix";

const mix = (instrument: "violin" | "cello"): VoiceMixSnapshot => ({
  revision: 2,
  voices: [{ id: "ONE", kind: "pitched", instrument, muted: false }],
});

function createEngine(): { value: PlaybackEngine; dispose: ReturnType<typeof vi.fn> } {
  const dispose = vi.fn(() => Promise.resolve());
  return { value: {
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(() => Promise.resolve()),
    restart: vi.fn(),
    progress: vi.fn(() => 0),
    seek: vi.fn(),
    setLoop: vi.fn(),
    setTempoRatio: vi.fn(() => Promise.resolve()),
    dispose,
  }, dispose };
}

function setup() {
  const configure = vi.fn(() => Promise.resolve());
  const port: PlaybackReconfigurationPort = {
    captureContinuity: vi.fn(() => ({ progress: 0.4, playing: true })),
    snapshot: vi.fn(() => ({ status: "ready", mode: "playing", tempo: 110, loop: false } as const)),
    configure,
  };
  const failures: string[] = [];
  return {
    configure,
    failures,
    coordinator: new PlaybackMixCoordinator(port, (message) => failures.push(message)),
  };
}

describe("PlaybackMixCoordinator", () => {
  it("uses score tempo initially, then preserves the live session tempo", async () => {
    const { configure, coordinator } = setup();
    const first = createEngine().value;
    const second = createEngine().value;
    const source = { create: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second) };
    coordinator.adoptSource(source, 84);

    await coordinator.apply(mix("violin"));
    await coordinator.apply(mix("cello"));

    expect(configure).toHaveBeenNthCalledWith(
      1,
      first,
      84,
      { progress: 0.4, playing: true },
      84,
    );
    expect(configure).toHaveBeenNthCalledWith(
      2,
      second,
      84,
      { progress: 0.4, playing: true },
      110,
    );
  });

  it("disposes a stale build when rapid changes finish out of order", async () => {
    const { configure, coordinator } = setup();
    const first = createEngine();
    const second = createEngine();
    let resolveFirst!: (value: PlaybackEngine) => void;
    let resolveSecond!: (value: PlaybackEngine) => void;
    const source = {
      create: vi.fn()
        .mockReturnValueOnce(new Promise<PlaybackEngine>((resolve) => { resolveFirst = resolve; }))
        .mockReturnValueOnce(new Promise<PlaybackEngine>((resolve) => { resolveSecond = resolve; })),
    };
    coordinator.adoptSource(source, 96);

    const oldBuild = coordinator.apply(mix("violin"));
    const newBuild = coordinator.apply(mix("cello"));
    resolveSecond(second.value);
    await newBuild;
    resolveFirst(first.value);
    await oldBuild;

    expect(configure).toHaveBeenCalledOnce();
    expect(configure).toHaveBeenCalledWith(second.value, 96, expect.anything(), 96);
    expect(first.dispose).toHaveBeenCalledOnce();
  });

  it("reports only current source failures", async () => {
    const { failures, coordinator } = setup();
    coordinator.adoptSource({ create: vi.fn().mockRejectedValue(new Error("sample failed")) }, 96);
    await coordinator.apply(mix("violin"));
    expect(failures).toEqual(["sample failed"]);
  });
});
