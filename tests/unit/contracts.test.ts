import { describe, expect, it } from "vitest";
import {
  evaluateScoreRequestSchema,
  evaluateScoreResultSchema,
  playbackProfileSchema,
  renderScoreToolInputSchema,
  scoreOperationSchema,
} from "../../packages/contracts/src/index";

describe("versioned v2 contracts", () => {
  it("rejects an unsupported future request schema", () => {
    expect(() => evaluateScoreRequestSchema.parse({
      schemaVersion: 3,
      abc: "X:1\nK:C\nC|]",
      revision: 0,
    })).toThrow();
  });

  it("publishes every canonical score operation as a strict discriminated DTO", () => {
    expect(scoreOperationSchema.parse({ kind: "transpose", semitones: -12 })).toEqual({
      kind: "transpose",
      semitones: -12,
    });
    expect(scoreOperationSchema.parse({
      kind: "assign_instrument",
      voiceId: "RH",
      instrumentId: "violin",
    })).toMatchObject({ kind: "assign_instrument", voiceId: "RH" });
    expect(scoreOperationSchema.parse({
      kind: "set_voice_muted",
      voiceId: "LH",
      muted: true,
    })).toMatchObject({ kind: "set_voice_muted", muted: true });
    expect(scoreOperationSchema.parse({ kind: "restore_original" })).toEqual({
      kind: "restore_original",
    });
    expect(() => scoreOperationSchema.parse({ kind: "transpose", semitones: 2.5 })).toThrow();
  });

  it("keeps render_score public input strictly on schema v2", () => {
    expect(() => renderScoreToolInputSchema.parse({
      schemaVersion: 1,
      abc: "X:1\nK:C\nC|]",
    })).toThrow();
  });

  it("normalizes playback defaults at the external boundary", () => {
    expect(playbackProfileSchema.parse({})).toEqual({
      instruments: {},
      mutedVoices: [],
      loop: false,
    });
  });

  it("serializes valid discriminated results deterministically", () => {
    const result = evaluateScoreResultSchema.parse({
      status: "unsupported",
      diagnostics: [{
        code: "UNSUPPORTED_ABC_FEATURE",
        severity: "error",
        message: "The construct cannot be edited safely.",
        suggestedCorrection: "Replace it with explicit notes.",
      }],
    });
    expect(JSON.stringify(result)).toBe(JSON.stringify(
      evaluateScoreResultSchema.parse(JSON.parse(JSON.stringify(result))),
    ));
  });
});
