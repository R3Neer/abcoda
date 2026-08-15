import { describe, expect, it, vi } from "vitest";
import {
  PlaybackSessionController,
  type PlaybackEngine,
  type PlaybackSessionState,
} from "../../apps/widget/src/application/playback-session";

function setup() {
  const spies = {
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(() => Promise.resolve()),
    restart: vi.fn(),
    progress: vi.fn(() => 0.375),
    seek: vi.fn(),
    setLoop: vi.fn(),
    setTempoRatio: vi.fn(() => Promise.resolve()),
    dispose: vi.fn(() => Promise.resolve()),
  };
  const engine: PlaybackEngine = {
    ...spies,
  };
  const states: PlaybackSessionState[] = [];
  const controller = new PlaybackSessionController(100, 100, false, (state) => states.push(state));
  return { controller, engine, states, spies };
}

describe("PlaybackSessionController", () => {
  it("has no impossible ready/busy boolean combinations", async () => {
    const { controller, engine, states } = setup();
    await controller.configure(engine, 100);
    await controller.togglePlayback();
    await controller.togglePlayback();

    expect(states.map((state) => state.status)).toContain("transitioning");
    expect(controller.snapshot()).toMatchObject({ status: "ready", mode: "paused" });
  });

  it("ignores a stale configuration and disposes its engine", async () => {
    const { controller, engine: first, spies } = setup();
    let release!: () => void;
    spies.setTempoRatio.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const second: PlaybackEngine = {
      ...first,
      setTempoRatio: vi.fn(() => Promise.resolve()),
      dispose: vi.fn(() => Promise.resolve()),
    };

    const stale = controller.configure(first, 100);
    await controller.configure(second, 100);
    release();
    await stale;

    expect(spies.dispose).toHaveBeenCalledOnce();
    expect(controller.snapshot()).toMatchObject({ status: "ready", mode: "paused" });
  });

  it("restores clamped continuity and resumes only when requested", async () => {
    const { controller, engine, spies } = setup();
    await controller.configure(engine, 100, { progress: 2, playing: true });

    expect(spies.seek).toHaveBeenCalledWith(1);
    expect(spies.play).toHaveBeenCalledOnce();
    expect(controller.snapshot()).toMatchObject({ status: "ready", mode: "playing" });
  });

  it("blocks control races while an async transition is running", async () => {
    const { controller, engine, spies } = setup();
    await controller.configure(engine, 100);
    let release!: () => void;
    spies.play.mockReturnValue(new Promise((resolve) => { release = resolve; }));

    const first = controller.togglePlayback();
    const second = controller.togglePlayback();
    expect(controller.snapshot()).toMatchObject({ status: "transitioning", intent: "play" });
    expect(spies.play).toHaveBeenCalledOnce();
    release();
    await Promise.all([first, second]);
    expect(controller.snapshot()).toMatchObject({ status: "ready", mode: "playing" });
  });

  it("applies loop changes while playback is still starting", async () => {
    const { controller, engine, spies } = setup();
    await controller.configure(engine, 100);
    let release!: () => void;
    spies.play.mockReturnValue(new Promise((resolve) => { release = resolve; }));

    const starting = controller.togglePlayback();
    controller.setLoop(true);

    expect(controller.snapshot()).toMatchObject({ status: "transitioning", loop: true });
    expect(spies.setLoop).toHaveBeenLastCalledWith(true);
    release();
    await starting;
    expect(controller.snapshot()).toMatchObject({ status: "ready", mode: "playing", loop: true });
  });

  it("does not let an obsolete transition overwrite a replacement engine", async () => {
    const { controller, engine: first, spies } = setup();
    await controller.configure(first, 100);
    let release!: () => void;
    spies.setTempoRatio.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const changingTempo = controller.setTempo(120);
    const secondSetup = setup();

    await controller.configure(secondSetup.engine, 90);
    release();
    await changingTempo;

    expect(controller.snapshot()).toMatchObject({ status: "ready", mode: "paused", tempo: 120 });
    expect(secondSetup.spies.setTempoRatio).toHaveBeenCalledWith(120 / 90);
  });

  it("keeps loop and tempo preferences before an engine exists", async () => {
    const { controller, engine, spies } = setup();
    controller.setLoop(true);
    await controller.setTempo(125);
    await controller.configure(engine, 100);

    expect(spies.setLoop).toHaveBeenCalledWith(true);
    expect(spies.setTempoRatio).toHaveBeenCalledWith(1.25);
    expect(controller.snapshot()).toMatchObject({ status: "ready", tempo: 125, loop: true });
  });

  it("adopts an explicit tempo when a new host score replaces the session", async () => {
    const { controller, engine, spies } = setup();
    await controller.configure(engine, 84, undefined, 84);

    expect(spies.setTempoRatio).toHaveBeenCalledWith(1);
    expect(controller.snapshot()).toMatchObject({ status: "ready", tempo: 84 });
  });

  it("turns engine failures into explicit state", async () => {
    const { controller, engine, spies } = setup();
    spies.setTempoRatio.mockRejectedValue(new Error("decode failed"));

    await controller.configure(engine, 100);

    expect(controller.snapshot()).toEqual({
      status: "failed",
      tempo: 100,
      loop: false,
      message: "decode failed",
    });
  });

  it("fails only the audio session and disposes its current engine", async () => {
    const { controller, engine, spies } = setup();
    await controller.configure(engine, 100);

    await controller.fail("sample unavailable");

    expect(spies.dispose).toHaveBeenCalledOnce();
    expect(controller.snapshot()).toEqual({
      status: "failed",
      tempo: 100,
      loop: false,
      message: "sample unavailable",
    });
  });
});
