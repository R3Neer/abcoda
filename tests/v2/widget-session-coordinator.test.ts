import { describe, expect, it, vi } from "vitest";
import type {
  HostBridge,
  HostBridgeHandlers,
} from "../../apps/widget/src/application/host-bridge";
import type {
  EngravingResult,
} from "../../apps/widget/src/application/score-session";
import {
  WidgetSessionCoordinator,
  type RangeAwareEngraver,
  type SessionTimerDriver,
  type WidgetSessionView,
} from "../../apps/widget/src/application/widget-session-coordinator";
import type { DraftEvaluator, DraftTransformer } from "../../apps/widget/src/application/draft-session";
import type { CursorView } from "../../apps/widget/src/application/score-cursor";
import type { VoiceMixSnapshot } from "../../apps/widget/src/application/voice-mix";

function scoreResult(revision: number, presentation?: Record<string, unknown>): unknown {
  return {
    status: "success",
    snapshot: {
      schemaVersion: 2,
      revision,
      document: {
        tuneId: `tune-${revision}`,
        title: `Revision ${revision}`,
        tempo: { beatUnit: "quarter", bpm: 84 },
        voices: [{ id: "RH", kind: "pitched" }],
        source: {
          format: "abc",
          text: `X:${revision}\nT:Revision ${revision}\nL:1/4\nQ:1/4=84\nV:RH\nK:C\n[V:RH] C D E F|]`,
        },
      },
      diagnostics: [],
    },
    ...(presentation ? { presentation } : {}),
  };
}

class FakeHost implements HostBridge {
  handlers: HostBridgeHandlers | undefined;

  connect(handlers: HostBridgeHandlers): Promise<void> {
    this.handlers = handlers;
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this.handlers = undefined;
    return Promise.resolve();
  }

  result(value: unknown): void {
    this.handlers?.onResult(value);
  }
}

class FakeTimers implements SessionTimerDriver {
  private next = 0;
  private readonly callbacks = new Map<number, () => void>();
  readonly cancelled: number[] = [];

  schedule(callback: () => void): unknown {
    const id = ++this.next;
    this.callbacks.set(id, callback);
    return id;
  }

  cancel(handle: unknown): void {
    const id = Number(handle);
    this.cancelled.push(id);
    this.callbacks.delete(id);
  }

  run(id: number): void {
    const callback = this.callbacks.get(id);
    this.callbacks.delete(id);
    callback?.();
  }

  activeIds(): number[] {
    return [...this.callbacks.keys()];
  }
}

function harness() {
  const host = new FakeHost();
  const timers = new FakeTimers();
  const mixes: VoiceMixSnapshot[] = [];
  const showScore = vi.fn<WidgetSessionView["showScore"]>();
  const showPresentation = vi.fn<WidgetSessionView["showPresentation"]>();
  const view: WidgetSessionView = {
    showScore,
    showPlayback: vi.fn(),
    showMix: (state) => mixes.push(state),
    showDraft: vi.fn(),
    showPresentation,
    applyHostContext: vi.fn(),
  };
  const refreshGeometry = vi.fn();
  const cursorView: CursorView = {
    show: vi.fn(),
    hide: vi.fn(),
    refreshGeometry,
  };
  let width = 900;
  const engraving: EngravingResult = {
    timeline: {
      totalDurationMs: 1000,
      events: [{
        timeMs: 0,
        durationMs: 1000,
        measure: 1,
        line: 0,
        x: 10,
        sourceOffsets: [20],
      }],
    },
    voicePitches: { RH: [60] },
  };
  const render = vi.fn<RangeAwareEngraver["render"]>(
    () => Promise.resolve(engraving),
  );
  const engraver: RangeAwareEngraver = {
    render,
    clear: vi.fn(),
    showVoiceRanges: vi.fn(),
  };
  const evaluator: DraftEvaluator = {
    evaluate: (abc, revision) => Promise.resolve({
      status: "success",
      snapshot: {
        schemaVersion: 2,
        revision,
        document: {
          tuneId: `local-${revision}`,
          voices: [{ id: "RH", kind: "pitched" }],
          source: { format: "abc", text: abc },
        },
        diagnostics: [],
      },
    }),
  };
  const transformer: DraftTransformer = {
    transpose: (abc) => abc,
    transposeVoice: (abc) => abc,
  };
  const presentVoiceRanges = vi.fn();
  const session = new WidgetSessionCoordinator({
    view,
    cursorView,
    createEngraver: () => engraver,
    hostBridge: host,
    draftEvaluator: evaluator,
    draftTransformer: transformer,
    getViewportWidth: () => width,
    presentVoiceRanges,
    initialViewportWidth: width,
    timers,
  });
  return {
    session,
    host,
    timers,
    view,
    mixes,
    render,
    engraver,
    refreshGeometry,
    showPresentation,
    presentVoiceRanges,
    setWidth(value: number) { width = value; },
  };
}

async function waitForReady(view: WidgetSessionView): Promise<void> {
  const showScore = vi.mocked(view.showScore);
  await vi.waitFor(() => {
    expect(showScore.mock.calls.at(-1)?.[0]).toMatchObject({ status: "ready" });
  });
}

describe("WidgetSessionCoordinator", () => {
  it("treats a host result as a composition boundary and prevents mix leakage", async () => {
    const h = harness();
    await h.session.start();
    h.host.result(scoreResult(1));
    await waitForReady(h.view);

    h.session.setInstrument("RH", "cello");
    expect(h.mixes.at(-1)?.voices[0]?.instrument).toBe("cello");

    h.host.result(scoreResult(2));
    await vi.waitFor(() => {
      expect(h.mixes.at(-1)?.revision).toBe(2);
    });
    expect(h.mixes.at(-1)?.voices[0]?.instrument).toBe("acoustic_grand_piano");

    h.session.dispose();
  });

  it("debounces semantic reflow while refreshing cursor geometry immediately", async () => {
    const h = harness();
    await h.session.start();
    h.host.result(scoreResult(1, { preferredMeasuresPerLine: 4 }));
    await waitForReady(h.view);
    expect(h.render).toHaveBeenCalledTimes(1);

    h.setWidth(700);
    h.session.viewportChanged(700);
    const first = h.timers.activeIds()[0]!;
    expect(h.refreshGeometry).toHaveBeenCalledTimes(1);

    h.setWidth(600);
    h.session.viewportChanged(600);
    expect(h.timers.cancelled).toContain(first);
    const active = h.timers.activeIds();
    expect(active).toHaveLength(1);

    h.timers.run(active[0]!);
    await vi.waitFor(() => expect(h.render).toHaveBeenCalledTimes(2));
    expect(h.render.mock.calls[1]?.[3]).toEqual({ includePlayback: false });
    expect(h.showPresentation).toHaveBeenCalledTimes(1);

    h.session.dispose();
  });

  it("does not schedule semantic reflow for insignificant width changes", async () => {
    const h = harness();
    await h.session.start();
    h.host.result(scoreResult(1));
    await waitForReady(h.view);

    h.session.viewportChanged(900.2);
    expect(h.timers.activeIds()).toEqual([]);

    h.session.dispose();
  });

  it("cancels pending reflow and tears down owned effects once", async () => {
    const h = harness();
    await h.session.start();
    h.host.result(scoreResult(1));
    await waitForReady(h.view);

    h.setWidth(600);
    h.session.viewportChanged(600);
    const active = h.timers.activeIds()[0]!;
    h.session.dispose();
    h.session.dispose();

    expect(h.timers.cancelled.filter((id) => id === active)).toHaveLength(1);
    expect(h.timers.activeIds()).toEqual([]);
  });
});
