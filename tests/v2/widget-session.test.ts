import { describe, expect, it, vi } from "vitest";
import {
  ScoreSessionController,
  type Engraver,
  type ScoreSessionState,
} from "../../apps/widget/src/application/score-session";

function deferred(): {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
} {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function snapshot(revision: number, title = `Revision ${revision}`): unknown {
  return {
    status: "success",
    snapshot: {
      schemaVersion: 2,
      revision,
      document: {
        tuneId: String(revision),
        title,
        voiceIds: ["default"],
        source: { format: "abc", text: `X:${revision}\nT:${title}\nK:C\nC4|]` },
      },
      diagnostics: [],
    },
  };
}

describe("v2 widget score session", () => {
  it("publishes only the newest engraving revision", async () => {
    const first = deferred();
    const second = deferred();
    const render = vi.fn<Engraver["render"]>((_abc, signal) => {
      const call = render.mock.calls.length;
      const pending = call === 1 ? first : second;
      return new Promise<void>((resolve, reject) => {
        pending.promise.then(resolve, reject);
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    const engraver: Engraver = { render, clear: vi.fn() };
    const states: ScoreSessionState[] = [];
    const controller = new ScoreSessionController(engraver, (state) => states.push(state));

    const oldRevision = controller.receive(snapshot(1));
    const newRevision = controller.receive(snapshot(2));
    first.resolve();
    second.resolve();
    await Promise.all([oldRevision, newRevision]);

    const readyStates = states.filter(
      (state): state is Extract<ScoreSessionState, { status: "ready" }> => state.status === "ready",
    );
    expect(readyStates).toHaveLength(1);
    expect(readyStates[0]?.snapshot.revision).toBe(2);
  });

  it("rejects malformed host data before invoking the engraver", async () => {
    const render = vi.fn<Engraver["render"]>(() => Promise.resolve());
    const engraver: Engraver = { render, clear: vi.fn() };
    const states: ScoreSessionState[] = [];
    const controller = new ScoreSessionController(engraver, (state) => states.push(state));

    await controller.receive({ schemaVersion: 2, revision: 1 });

    expect(render).not.toHaveBeenCalled();
    expect(states.at(-1)).toMatchObject({ status: "invalid" });
  });

  it("shows domain diagnostics without invoking the engraver", async () => {
    const render = vi.fn<Engraver["render"]>(() => Promise.resolve());
    const engraver: Engraver = { render, clear: vi.fn() };
    const states: ScoreSessionState[] = [];
    const controller = new ScoreSessionController(engraver, (state) => states.push(state));

    await controller.receive({
      status: "invalid",
      diagnostics: [
        {
          code: "ABC_MULTIPLE_TUNES_UNSUPPORTED",
          severity: "error",
          message: "ABCoda accepts one tune per score snapshot.",
        },
      ],
    });

    expect(render).not.toHaveBeenCalled();
    expect(states.at(-1)).toEqual({
      status: "invalid",
      message: "ABCoda accepts one tune per score snapshot.",
    });
  });

  it("ignores snapshots older than the active revision", async () => {
    const render = vi.fn<Engraver["render"]>(() => Promise.resolve());
    const engraver: Engraver = { render, clear: vi.fn() };
    const states: ScoreSessionState[] = [];
    const controller = new ScoreSessionController(engraver, (state) => states.push(state));

    await controller.receive(snapshot(5));
    await controller.receive(snapshot(4));

    expect(render).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toMatchObject({ status: "ready", snapshot: { revision: 5 } });
  });
});
