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
    const evaluator: DraftEvaluator = {
      evaluate: vi.fn((abc: string, revision: number) => Promise.resolve<EvaluateScoreResultDto>({
        status: "success",
        snapshot: snapshot(revision, abc),
      })),
    };
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
    });
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
    expect(draft.snapshot()).toMatchObject({ draft: "original", lastGood: { revision: 7 } });
    expect(applied.at(-1)).toMatchObject({ status: "success", snapshot: { revision: 7 } });
  });
});
