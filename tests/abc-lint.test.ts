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

    const tune = ABCJS.parseOnly(result.score.abc)[0];
    const staves = tune?.lines.flatMap((line) => line.staff ?? []) ?? [];
    expect(staves.some((staff) => staff.clef?.type === "perc")).toBe(true);
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
});

