import { describe, expect, it } from "vitest";
import {
  scoreSnapshotSchema,
  type ScoreSnapshotDto,
} from "@abcoda/contracts";
import {
  fromScoreSnapshotDto,
  toScoreSnapshotDto,
} from "../../apps/worker/src/mcp/score-contract-mapper";

describe("score contract mapper", () => {
  it("round-trips the public score snapshot DTO without protocol loss", () => {
    const snapshot: ScoreSnapshotDto = scoreSnapshotSchema.parse({
      schemaVersion: 2,
      revision: 23,
      document: {
        tuneId: "roundtrip",
        title: "Boundary roundtrip",
        meter: "6/8",
        key: "G",
        tempo: { beatUnit: "quarter", bpm: 72 },
        voices: [
          { id: "LEAD", kind: "pitched" },
          { id: "DR", kind: "unpitched_percussion" },
        ],
        source: {
          format: "abc",
          text: "X:roundtrip\nT:Boundary roundtrip\nM:6/8\nQ:1/4=72\nK:G\nC6|]",
        },
      },
      diagnostics: [
        {
          code: "UNSUPPORTED_ABC_FEATURE",
          severity: "warning",
          message: "Kept to prove diagnostic mapping is lossless.",
          range: {
            start: { line: 6, column: 1, offset: 55 },
            end: { line: 6, column: 3, offset: 57 },
          },
          suggestedCorrection: "Use a supported construct.",
        },
      ],
    });

    const internal = fromScoreSnapshotDto(snapshot);

    expect(internal).not.toHaveProperty("schemaVersion");
    expect(toScoreSnapshotDto(internal)).toEqual(snapshot);
  });
});
