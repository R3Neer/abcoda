import { describe, expect, it, vi } from "vitest";
import type { EvaluateScoreResultDto, ScoreSnapshotDto } from "../../packages/contracts/src/index";
import {
  DraftSessionController,
  type DraftEvaluator,
  type DraftSessionState,
} from "../../apps/widget/src/application/draft-session";

function snapshot(revision: number, text: string): ScoreSnapshotDto {
  return {
    schemaVersion: 2,
    revision,
    document: {
      tuneId: "1",
      voices: [{ id: "default", kind: "pitched" }],
      source: { format: "abc", text },
    },
    diagnostics: [],
  };
}

describe("DraftSessionController", () => {
  it("keeps original, draft, and last-good revisions separate", async () => {
    const applied: EvaluateScoreResultDto[] = [];
    const evaluate = vi.fn((abc: string, revision: number) => Promise.resolve<EvaluateScoreResultDto>({
        status: "success",
        snapshot: snapshot(revision, abc),
      }));
    const evaluator: DraftEvaluator = { evaluate };
    const draft = new DraftSessionController(evaluator, () => undefined, (result) => applied.push(result));
    draft.adoptHostSnapshot(snapshot(4, "X:1\nK:C\nC|]"));
    draft.edit("X:1\nK:C\nD|]");
    await draft.apply();

    expect(draft.snapshot()).toMatchObject({
      status: "clean",
      original: { revision: 4, document: { source: { text: "X:1\nK:C\nC|]" } } },
      lastGood: { revision: 5, document: { source: { text: "X:1\nK:C\nD|]" } } },
    });
    expect(applied).toHaveLength(1);
    expect(draft.snapshot()).toMatchObject({ history: [{ id: "original", status: "original" }] });
    expect(draft.commit("Main idea")).toBe(true);
    expect(draft.snapshot()).toMatchObject({
      history: [
        { id: "original", status: "original" },
        { id: "commit-1", label: "Main idea", status: "valid" },
      ],
      currentVersionId: "commit-1",
    });
  });

  it("preserves the last good snapshot when validation is invalid", async () => {
    const evaluator: DraftEvaluator = {
      evaluate: vi.fn(() => Promise.resolve<EvaluateScoreResultDto>({
        status: "invalid",
        diagnostics: [{ code: "ABC_TUNE_REFERENCE_MISSING", severity: "error", message: "missing X" }],
      })),
    };
    const draft = new DraftSessionController(evaluator, () => undefined, () => undefined);
    draft.adoptHostSnapshot(snapshot(1, "X:1\nK:C\nC|]"));
    draft.edit("K:C\nC|]");
    await draft.apply();

    expect(draft.snapshot()).toMatchObject({
      status: "invalid",
      draft: "K:C\nC|]",
      lastGood: { revision: 1 },
      diagnostics: [{ message: "missing X" }],
      history: [{ status: "original" }],
    });
    expect(draft.commit("Broken experiment")).toBe(true);
    expect(draft.snapshot()).toMatchObject({
      history: [
        { status: "original" },
        { id: "commit-1", label: "Broken experiment", status: "invalid", abc: "K:C\nC|]" },
      ],
    });
  });

  it("auto-applies only after the configured idle period", async () => {
    vi.useFakeTimers();
    const evaluate = vi.fn((abc: string, revision: number) => Promise.resolve<EvaluateScoreResultDto>({
        status: "success",
        snapshot: snapshot(revision, abc),
      }));
    const evaluator: DraftEvaluator = { evaluate };
    const draft = new DraftSessionController(evaluator, () => undefined, () => undefined, undefined, 700);
    draft.adoptHostSnapshot(snapshot(1, "original"));
    draft.edit("first");
    await vi.advanceTimersByTimeAsync(500);
    draft.edit("second");
    await vi.advanceTimersByTimeAsync(699);
    expect(evaluate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(evaluate).toHaveBeenCalledOnce();
    expect(evaluate).toHaveBeenCalledWith("second", 2, expect.any(AbortSignal));
    expect(draft.snapshot()).toMatchObject({ history: [{ id: "original" }] });
    vi.useRealTimers();
  });

  it("applies explicit transposition commands without waiting for the editor debounce", async () => {
    vi.useFakeTimers();

    const evaluate = vi.fn(
      (
        abc: string,
        revision: number,
      ) =>
        Promise.resolve<EvaluateScoreResultDto>({
          status: "success",
          snapshot: snapshot(
            revision,
            abc,
          ),
        }),
    );

    const draft =
      new DraftSessionController(
        { evaluate },
        () => undefined,
        () => undefined,
        {
          transpose: (
            abc,
            semitones,
          ) =>
            `${abc}\n% score ${semitones}`,

          transposeVoice: (
            abc,
            voiceId,
            semitones,
          ) =>
            `${abc}\n% voice ${voiceId} ${semitones}`,
        },
        700,
      );

    draft.adoptHostSnapshot(
      snapshot(
        1,
        "X:1\nK:C\nC|]",
      ),
    );

    draft.transpose(2);

    // No clock advancement: evaluation starts immediately.
    expect(evaluate).toHaveBeenCalledOnce();
    expect(evaluate).toHaveBeenLastCalledWith(
      "X:1\nK:C\nC|]\n% score 2",
      2,
      expect.any(AbortSignal),
    );

    await Promise.resolve();
    await Promise.resolve();

    draft.transposeVoice(
      "default",
      -3,
    );

    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(evaluate).toHaveBeenLastCalledWith(
      "X:1\nK:C\nC|]\n% score 2\n% voice default -3",
      3,
      expect.any(AbortSignal),
    );

    // There must not be a delayed second application waiting
    // behind the explicit commands.
    await vi.advanceTimersByTimeAsync(700);

    expect(evaluate).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("restores valid and invalid versions from one history", async () => {
    const evaluator: DraftEvaluator = {
      evaluate: vi.fn((abc: string, revision: number) => abc === "bad"
        ? Promise.resolve<EvaluateScoreResultDto>({
          status: "invalid",
          diagnostics: [{ code: "ABC_SOURCE_EMPTY", severity: "error", message: "bad" }],
        })
        : Promise.resolve<EvaluateScoreResultDto>({ status: "success", snapshot: snapshot(revision, abc) })),
    };
    const applied: EvaluateScoreResultDto[] = [];
    const draft = new DraftSessionController(evaluator, () => undefined, (result) => applied.push(result));
    draft.adoptHostSnapshot(snapshot(1, "original"));
    draft.edit("valid");
    await draft.apply();
    expect(draft.commit("Valid take")).toBe(true);
    draft.edit("bad");
    await draft.apply();
    expect(draft.commit("Broken take")).toBe(true);

    draft.restoreVersion("commit-2");
    expect(draft.snapshot()).toMatchObject({ status: "invalid", draft: "bad" });
    draft.restoreVersion("commit-1");
    expect(draft.snapshot()).toMatchObject({ status: "clean", draft: "valid" });
    expect(applied.at(-1)).toMatchObject({ snapshot: { revision: 4 } });
  });

  it("refuses blank commits and drafts that have not rendered yet", () => {
    const draft = new DraftSessionController({ evaluate: vi.fn() }, () => undefined, () => undefined);
    draft.adoptHostSnapshot(snapshot(1, "original"));
    expect(draft.commit("  ")).toBe(false);
    draft.edit("pending");
    expect(draft.commit("Too soon")).toBe(false);
    expect(draft.snapshot()).toMatchObject({ history: [{ id: "original" }] });
  });

  it("does not let a stale validation overwrite a newer draft", async () => {
    const pending: Array<(result: EvaluateScoreResultDto) => void> = [];
    const evaluator: DraftEvaluator = {
      evaluate: vi.fn(() => new Promise<EvaluateScoreResultDto>((resolve) => pending.push(resolve))),
    };
    const states: DraftSessionState[] = [];
    const draft = new DraftSessionController(evaluator, (state) => states.push(state), () => undefined);
    draft.adoptHostSnapshot(snapshot(1, "X:1\nK:C\nC|]"));
    draft.edit("X:1\nK:C\nD|]");
    const oldValidation = draft.apply();
    draft.edit("X:1\nK:C\nE|]");
    const newValidation = draft.apply();
    pending[1]!({ status: "success", snapshot: snapshot(3, "X:1\nK:C\nE|]") });
    await newValidation;
    pending[0]!({ status: "invalid", diagnostics: [] });
    await oldValidation;

    expect(draft.snapshot()).toMatchObject({
      status: "clean",
      lastGood: { revision: 3, document: { source: { text: "X:1\nK:C\nE|]" } } },
    });
    expect(states.at(-1)?.status).toBe("clean");
  });

  it("restores either the last good text or the immutable host original", async () => {
    const applied: EvaluateScoreResultDto[] = [];
    const evaluator: DraftEvaluator = {
      evaluate: vi.fn((abc: string, revision: number) => Promise.resolve<EvaluateScoreResultDto>({
        status: "success",
        snapshot: snapshot(revision, abc),
      })),
    };
    const draft = new DraftSessionController(evaluator, () => undefined, (result) => applied.push(result));
    draft.adoptHostSnapshot(snapshot(7, "original"));
    draft.edit("accepted");
    await draft.apply();
    draft.edit("unfinished");
    draft.restoreLastGood();
    expect(draft.snapshot()).toMatchObject({ draft: "accepted", original: { revision: 7 } });
    draft.restoreOriginal();
    expect(draft.snapshot()).toMatchObject({
      draft: "original",
      original: { revision: 7 },
      lastGood: { revision: 9 },
    });
    expect(applied.at(-1)).toMatchObject({ status: "success", snapshot: { revision: 9 } });
  });

  it("reports unavailable transposition operations as draft errors", () => {
    const unavailable = new DraftSessionController(
      { evaluate: vi.fn() },
      () => undefined,
      () => undefined,
    );
    unavailable.adoptHostSnapshot(snapshot(1, "X:1\nK:C\nC|]"));
    unavailable.transpose(2);
    expect(unavailable.snapshot()).toMatchObject({
      status: "invalid",
      diagnostics: [{ code: "ABC_TRANSPOSITION_FAILED" }],
    });
  });
});
