import { describe, expect, it, vi } from "vitest";
import { TransportController, type PlaybackBackend } from "../web/src/transport";

function setup(options: { tempo?: number; loop?: boolean } = {}) {
  const backend: PlaybackBackend = {
    play: vi.fn(),
    pause: vi.fn(),
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
    controller.togglePlayback();
    expect(backend.play).not.toHaveBeenCalled();
    expect(backend.pause).not.toHaveBeenCalled();
  });

  it("handles repeated play → pause → play clicks on one control", async () => {
    const { backend, controller } = setup();
    controller.beginConfiguration();
    await controller.completeConfiguration(backend);

    controller.togglePlayback();
    expect(backend.play).toHaveBeenCalledTimes(1);
    expect(controller.snapshot().playing).toBe(true);

    controller.togglePlayback();
    expect(backend.pause).toHaveBeenCalledTimes(1);
    expect(controller.snapshot().playing).toBe(false);

    controller.togglePlayback();
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

  it("recovers button availability after a configuration failure", () => {
    const { controller } = setup();
    controller.beginConfiguration();
    controller.failConfiguration();
    expect(controller.snapshot()).toMatchObject({ ready: false, busy: false, playing: false });
  });
});
