import { describe, expect, it, vi } from "vitest";
import { TransportController, type PlaybackBackend } from "../web/src/transport";

function setup(options: { tempo?: number; loop?: boolean } = {}) {
  const backend: PlaybackBackend = {
    play: vi.fn(),
    pause: vi.fn(),
    restart: vi.fn(),
    getProgress: vi.fn(() => .375),
    setProgress: vi.fn(),
    toggleLoop: vi.fn(),
    setWarp: vi.fn().mockResolvedValue(undefined),
  };
  const states: Array<ReturnType<TransportController["snapshot"]>> = [];
  const controller = new TransportController(
    100,
    options.tempo ?? 100,
    options.loop ?? false,
    (state) => states.push({ ...state }),
  );
  return { backend, controller, states };
}

describe("transport button sequences", () => {
  it("ignores the playback toggle until audio is ready", () => {
    const { backend, controller } = setup();
    void controller.togglePlayback();
    expect(backend.play).not.toHaveBeenCalled();
    expect(backend.pause).not.toHaveBeenCalled();
  });

  it("handles repeated play → pause → play clicks on one control", async () => {
    const { backend, controller } = setup();
    controller.beginConfiguration();
    await controller.completeConfiguration(backend);

    await controller.togglePlayback();
    expect(backend.play).toHaveBeenCalledTimes(1);
    expect(controller.snapshot().playing).toBe(true);

    await controller.togglePlayback();
    expect(backend.pause).toHaveBeenCalledTimes(1);
    expect(controller.snapshot().playing).toBe(false);

    await controller.togglePlayback();
    expect(backend.play).toHaveBeenCalledTimes(2);
    expect(controller.snapshot().playing).toBe(true);
  });

  it("can play again after abcjs reports natural completion", async () => {
    const { backend, controller } = setup();
    await controller.completeConfiguration(backend);
    controller.play();
    controller.playbackFinished();
    controller.play();
    expect(backend.play).toHaveBeenCalledTimes(2);
  });

  it("returns to the beginning without changing play/pause state", async () => {
    const { backend, controller } = setup();
    await controller.completeConfiguration(backend);
    await controller.togglePlayback();
    controller.rewind();
    expect(backend.restart).toHaveBeenCalledOnce();
    expect(controller.snapshot().playing).toBe(true);
  });

  it("seeks while paused or playing and clamps invalid progress", async () => {
    const { backend, controller } = setup();
    await controller.completeConfiguration(backend);
    controller.seek(.42);
    await controller.togglePlayback();
    controller.seek(2);
    controller.seek(-1);
    expect(backend.setProgress).toHaveBeenNthCalledWith(1, .42);
    expect(backend.setProgress).toHaveBeenNthCalledWith(2, 1);
    expect(backend.setProgress).toHaveBeenNthCalledWith(3, 0);
    expect(controller.snapshot().playing).toBe(true);
  });

  it("debounces a second click while abcjs is still changing state", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const { backend, controller } = setup();
    vi.mocked(backend.play).mockReturnValue(pending);
    await controller.completeConfiguration(backend);
    const first = controller.togglePlayback();
    const second = controller.togglePlayback();
    expect(backend.play).toHaveBeenCalledOnce();
    expect(controller.snapshot()).toMatchObject({ busy: true, playing: true });
    release();
    await Promise.all([first, second]);
    expect(controller.snapshot()).toMatchObject({ busy: false, playing: true });
  });
});

describe("loop, tempo and reconfiguration combinations", () => {
  it("stores loop before readiness and synchronizes it exactly once", async () => {
    const { backend, controller } = setup();
    controller.toggleLoop();
    expect(backend.toggleLoop).not.toHaveBeenCalled();
    await controller.completeConfiguration(backend);
    expect(backend.toggleLoop).toHaveBeenCalledOnce();
    expect(controller.snapshot().loop).toBe(true);
  });

  it("toggles loop during playback without stopping playback", async () => {
    const { backend, controller } = setup();
    await controller.completeConfiguration(backend);
    controller.play();
    controller.toggleLoop();
    controller.toggleLoop();
    expect(backend.toggleLoop).toHaveBeenCalledTimes(2);
    expect(controller.snapshot()).toMatchObject({ playing: true, loop: false });
  });

  it("stores tempo while loading and applies the latest value when ready", async () => {
    const { backend, controller } = setup();
    controller.beginConfiguration();
    await controller.setTempo(75);
    expect(backend.setWarp).not.toHaveBeenCalled();
    await controller.completeConfiguration(backend);
    expect(backend.setWarp).toHaveBeenLastCalledWith(75);
  });

  it("applies live tempo and preserves loop across audio reconfiguration", async () => {
    const { backend, controller } = setup({ loop: true });
    await controller.completeConfiguration(backend);
    await controller.setTempo(125);
    controller.beginConfiguration();
    await controller.completeConfiguration(backend);

    expect(backend.toggleLoop).toHaveBeenCalledOnce();
    expect(backend.setWarp).toHaveBeenNthCalledWith(1, 100);
    expect(backend.setWarp).toHaveBeenNthCalledWith(2, 125);
    expect(backend.setWarp).toHaveBeenNthCalledWith(3, 125);
    expect(controller.snapshot()).toMatchObject({ ready: true, busy: false, tempo: 125, loop: true });
  });

  it("restores position and resumes playback after an edit rebuild", async () => {
    const { backend, controller } = setup();
    await controller.completeConfiguration(backend);
    await controller.togglePlayback();
    const continuity = controller.captureContinuity();
    controller.beginConfiguration();
    await controller.completeConfiguration(backend, continuity);

    expect(continuity).toEqual({ progress: .375, playing: true });
    expect(backend.setProgress).toHaveBeenCalledWith(.375);
    expect(backend.play).toHaveBeenCalledTimes(2);
    expect(controller.snapshot()).toMatchObject({ ready: true, busy: false, playing: true });
  });

  it("restores a paused edit position without starting playback", async () => {
    const { backend, controller } = setup();
    await controller.completeConfiguration(backend);
    const continuity = controller.captureContinuity();
    controller.beginConfiguration();
    await controller.completeConfiguration(backend, continuity);

    expect(backend.setProgress).toHaveBeenCalledWith(.375);
    expect(backend.play).not.toHaveBeenCalled();
    expect(controller.snapshot()).toMatchObject({ ready: true, playing: false });
  });

  it("does not capture a stale position while a rebuild is already running", async () => {
    const { backend, controller } = setup();
    await controller.completeConfiguration(backend);
    controller.beginConfiguration();

    expect(controller.captureContinuity()).toBeUndefined();
  });

  it("blocks transport controls while abcjs rebuilds audio for a tempo change", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const { backend, controller } = setup();
    await controller.completeConfiguration(backend);
    vi.mocked(backend.setWarp).mockReturnValueOnce(pending);

    const changing = controller.setTempo(140);
    expect(controller.snapshot()).toMatchObject({ busy: true, tempo: 140 });
    await controller.togglePlayback();
    expect(backend.play).not.toHaveBeenCalled();
    release();
    await changing;
    expect(controller.snapshot()).toMatchObject({ busy: false, tempo: 140 });
  });

  it("recovers button availability after a configuration failure", () => {
    const { controller } = setup();
    controller.beginConfiguration();
    controller.failConfiguration();
    expect(controller.snapshot()).toMatchObject({ ready: false, busy: false, playing: false });
  });
});
