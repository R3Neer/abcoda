import ABCJS from "abcjs";
import { describe, expect, it } from "vitest";
import { normalizeAndLintScore } from "../shared/abc-lint";
import { renderScoreInputSchema } from "../shared/score";

function score(abc: string, overrides: Record<string, unknown> = {}) {
  return renderScoreInputSchema.parse({ abc, ...overrides });
}

describe("ABC mechanical normalization", () => {
  it("aligns the printed quarter-note tempo with playback", () => {
    const input = score("X:1\nT:Tempo\nM:4/4\nL:1/8\nQ:\"Andante\" 1/8=144\nK:C\nC8|]", {
      playback: { tempo: 72 },
    });
    const result = normalizeAndLintScore(input);
    expect(result.score.abc).toContain('Q:"Andante" 1/4=72');
  });

  it("inserts a missing Q field before the header-ending K field", () => {
    const result = normalizeAndLintScore(score("X:1\nT:Tempo\nM:4/4\nL:1/4\nK:C\nCDEF|]"));
    expect(result.score.abc).toContain("L:1/4\nQ:1/4=96\nK:C");
  });

  it("enforces percussion clef and voice-local K:none when explicitly typed", () => {
    const input = score(
      "X:1\nT:Band\nM:4/4\nL:1/4\nQ:1/4=100\nV:GTR clef=treble name=\"Guitar\"\nV:DR clef=bass name=\"Drums\"\nK:D\n%%score { GTR DR }\n[V:GTR] D E F G|]\n[V:DR] C C C C|]",
      { notation: { voiceKinds: { DR: "unpitched_percussion" } }, playback: { tempo: 100 } },
    );
    const result = normalizeAndLintScore(input);
    expect(result.score.abc).toContain('V:DR clef=perc name="Drums"');
    expect(result.score.abc).toContain("[V:DR][K:none clef=perc]");
    expect(result.score.playback.instruments.DR).toBe("percussion");

    const tune = ABCJS.parseOnly(result.score.abc)[0];
    const staves = tune?.lines.flatMap((line) => line.staff ?? []) ?? [];
    expect(staves.some((staff) => staff.clef?.type === "perc")).toBe(true);
  });

  it("infers percussion metadata and transposition from the composition brief", () => {
    const input = score(
      "X:1\nT:Band\nM:4/4\nL:1/4\nV:CL clef=treble name=\"Clarinet\"\nV:DR clef=bass name=\"Drums\"\nK:D\n%%score { CL DR }\n[V:CL] D E F G|]\n[V:DR] C C C C|]",
      {
        playback: { tempo: 100 },
        composition: {
          styleFamily: "jazz_blues",
          formFamily: "twelve_bar_blues",
          form: "one chorus",
          measures: 12,
          meter: "4/4",
          tempo: 100,
          rhythmicFeel: "swing",
          pitchFramework: "blues",
          pitchLanguage: "concert C blues",
          texture: "layered_groove",
          difficulty: "intermediate",
          intent: "performance",
          ensemble: [
            { voiceId: "CL", instrument: "B-flat clarinet", family: "woodwind", role: "melody", kind: "pitched", transpositionSemitones: -2 },
            { voiceId: "DR", instrument: "drum kit", family: "drum_kit", role: "beat", kind: "unpitched_percussion", transpositionSemitones: 0 },
          ],
        },
      },
    );
    const result = normalizeAndLintScore(input);
    expect(result.score.abc).toContain('V:CL clef=treble name="Clarinet" transpose=-2');
    expect(result.score.abc).toContain('V:DR clef=perc name="Drums"');
    expect(result.score.abc).toContain("[V:DR][K:none clef=perc]");
    expect(result.score.notation.voiceKinds).toEqual({ CL: "pitched", DR: "unpitched_percussion" });
  });
});

describe("ABC contract lint", () => {
  it("warns about missing descriptive headers without rejecting a render", () => {
    const result = normalizeAndLintScore(score("X:1\nK:C\nCDEF|"));
    expect(result.warnings).toContain("ABC header T: is missing.");
    expect(result.warnings).toContain("ABC header M: is missing.");
    expect(result.warnings).toContain("ABC header L: is missing.");
  });

  it("warns about unknown configuration and %%score voice IDs", () => {
    const input = score(
      "X:1\nT:Voices\nM:4/4\nL:1/4\nQ:1/4=96\nV:ONE clef=treble\nK:C\n%%score { ONE TWO }\n[V:ONE] CDEF|]",
      { playback: { instruments: { GHOST: "cello" } } },
    );
    const warnings = normalizeAndLintScore(input).warnings;
    expect(warnings).toContain("Configuration references unknown voice GHOST.");
    expect(warnings).toContain("%%score references undeclared voice TWO.");
  });

  it("warns when the rendered score contradicts its composition brief", () => {
    const input = score(
      "X:1\nT:Mismatch\nM:3/4\nL:1/4\nV:ONE clef=treble\nV:EXTRA clef=bass\nK:C\n%%score { ONE EXTRA }\n[V:ONE] CDE|]\n[V:EXTRA] C,DE|]",
      {
        playback: { tempo: 120 },
        notation: { voiceKinds: { ONE: "unpitched_percussion" } },
        composition: {
          styleFamily: "classical",
          formFamily: "period",
          form: "parallel period",
          measures: 8,
          meter: "4/4",
          tempo: 96,
          rhythmicFeel: "straight",
          pitchFramework: "tonal_functional",
          pitchLanguage: "C major",
          texture: "melody_accompaniment",
          difficulty: "beginner",
          intent: "study",
          ensemble: [{ voiceId: "ONE", instrument: "piano", family: "keyboard", role: "melody", kind: "pitched" }],
        },
      },
    );
    const warnings = normalizeAndLintScore(input).warnings;
    expect(warnings).toContain("Composition tempo 96 differs from playback tempo 120; playback tempo currently wins.");
    expect(warnings).toContain("Composition meter 4/4 differs from ABC M:3/4.");
    expect(warnings).toContain("ABC voice EXTRA is not described by the composition brief.");
    expect(warnings).toContain("Voice ONE has conflicting kinds: composition=pitched, notation=unpitched_percussion; composition kind wins.");
  });
});
