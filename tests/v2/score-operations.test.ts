import { describe, expect, it } from "vitest";
import {
  CanonicalScoreOperations,
  normalizeAbc,
  parseAbc,
  serializeAbc,
  transposeDocument,
} from "../../packages/abc-codec/src/index";
import { ApplyScoreOperation } from "../../packages/application/src/index";
import {
  asVoiceId,
  type PlaybackProfile,
  type ScoreDocument,
} from "../../packages/domain/src/index";

const mixed = `X:1
M:4/4
L:1/4
V:P clef=treble
V:D clef=perc
K:C
%%score { P D }
[V:P] "Am7/E"C D E F|[CEG]4|]
[V:D][K:none clef=perc] C D E F|C4|]
`;

function document(source = mixed): ScoreDocument {
  const result = parseAbc(source);
  if (!result.ok) throw new Error("Expected valid ABC.");
  return result.document;
}

const playback = (): PlaybackProfile => ({
  instruments: {},
  mutedVoices: [],
  loop: false,
});

describe("canonical score operations", () => {
  it("normalizes idempotently and reports every textual change", () => {
    const first = normalizeAbc("X:1\r\nK:C\r\nC|]");
    expect(first).toEqual({
      source: "X:1\nK:C\nC|]\n",
      changes: [
        { code: "NORMALIZE_NEWLINES", message: "Normalized line endings to LF." },
        { code: "ADD_FINAL_NEWLINE", message: "Added the final newline." },
      ],
    });
    expect(normalizeAbc(first.source)).toEqual({ source: first.source, changes: [] });
  });

  it("transposes pitched notes, chords and keys but never percussion", () => {
    const original = document();
    const transposed = transposeDocument(original, 2);
    expect(serializeAbc(transposed)).toContain("K:D");
    expect(serializeAbc(transposed)).toContain("[V:P] \"Bm7/F#\"D E ^F G|[D^FA]4|]");
    expect(serializeAbc(transposed)).toContain("[V:D][K:none clef=perc] C D E F|C4|]");

    const restored = transposeDocument(transposed, -2);
    expect(serializeAbc(restored)).toBe(serializeAbc(original));
  });

  it("transposes one selected voice without changing global harmony or percussion", () => {
    const original = document();
    const useCase =
      new ApplyScoreOperation(
        new CanonicalScoreOperations(),
      );

    const result = useCase.execute({
      document: original,
      original,
      playback: playback(),
      operation: {
        kind: "transpose_voice",
        voiceId: asVoiceId("P"),
        semitones: 2,
      },
    });

    expect(result.status).toBe("success");

    if (result.status !== "success") {
      throw new Error(
        "Expected voice transposition success.",
      );
    }

    const source =
      serializeAbc(result.document);

    expect(source).toContain("K:C");

    expect(source).toContain(
      '[V:P] "Am7/E"D E ^F G|[D^FA]4|]',
    );

    expect(source).toContain(
      "[V:D][K:none clef=perc] C D E F|C4|]",
    );
  });

  it("applies presentation operations immutably and restores the original aggregate", () => {
    const original = document();
    const transposed = transposeDocument(original, 2);
    const useCase = new ApplyScoreOperation(new CanonicalScoreOperations());
    const assigned = useCase.execute({
      document: transposed,
      original,
      playback: playback(),
      operation: {
        kind: "assign_instrument",
        voiceId: asVoiceId("P"),
        instrumentId: "violin",
      },
    });
    expect(assigned.status).toBe("success");
    if (assigned.status !== "success") throw new Error("Expected operation success.");
    expect(assigned.playback.instruments[asVoiceId("P")]).toBe("violin");
    expect(playback().instruments[asVoiceId("P")]).toBeUndefined();

    const muted = useCase.execute({
      document: assigned.document,
      original,
      playback: assigned.playback,
      operation: { kind: "set_voice_muted", voiceId: asVoiceId("P"), muted: true },
    });
    expect(muted.status === "success" && muted.playback.mutedVoices).toEqual(["P"]);

    const restored = useCase.execute({
      document: transposed,
      original,
      playback: assigned.playback,
      operation: { kind: "restore_original" },
    });
    expect(restored.status === "success" && restored.document).toBe(original);
  });

  it("does not publish a partial revision when an operation fails", () => {
    const current = document();
    const useCase = new ApplyScoreOperation(new CanonicalScoreOperations());
    const result = useCase.execute({
      document: current,
      original: current,
      playback: playback(),
      operation: {
        kind: "assign_instrument",
        voiceId: asVoiceId("missing"),
        instrumentId: "violin",
      },
    });
    expect(result).toMatchObject({
      status: "failure",
      diagnostics: [{ code: "ABC_OPERATION_FAILED" }],
    });
    expect(serializeAbc(current)).toBe(mixed);
  });

  it("distinguishes parse success from mechanical consistency", () => {
    const decoded = parseAbc("X:1\nM:4/4\nL:1/4\nK:C\nC D E|]\n");
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error("Expected syntactically accepted ABC.");
    expect(decoded.diagnostics).toMatchObject([{
      code: "ABC_MEASURE_DURATION_MISMATCH",
      severity: "warning",
    }]);
    expect(typeof decoded.diagnostics[0]?.suggestedCorrection).toBe("string");
  });

  it("reports undeclared voice references with a precise source range", () => {
    const source = "X:1\nV:A\nK:C\n[V:B] C4|]\n";
    const decoded = parseAbc(source);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error("Expected syntactically accepted ABC.");
    const diagnostic = decoded.diagnostics.find((item) => item.code === "ABC_VOICE_ID_INVALID");
    expect(diagnostic).toMatchObject({
      severity: "error",
      range: { start: { line: 4, column: 1 } },
    });
    expect(source.slice(diagnostic!.range!.start.offset, diagnostic!.range!.end.offset)).toBe("[V:B");
  });
});
