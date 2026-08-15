import ABCJS from "abcjs";
import { describe, expect, it } from "vitest";
import { normalizeAndLintScore } from "../shared/abc-lint";
import { renderScoreInputSchema } from "../shared/score";

function score(abc: string, overrides: Record<string, unknown> = {}) {
  return renderScoreInputSchema.parse({ abc, ...overrides });
}

const generatedComposition = {
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
  effort: "standard",
  intent: "study",
  ensemble: [{ voiceId: "default", instrument: "piano", family: "keyboard", role: "melody", kind: "pitched" }],
} as const;

describe("ABC mechanical normalization", () => {
  it("repairs missing multivoice grouping so engraving and audio begin together", () => {
    const input = score(
      "X:1\nT:Band\nM:4/4\nL:1/4\nQ:1/4=120\nV:LEAD clef=treble\nV:SYNTH clef=treble\nK:C\n[V:LEAD] CDEF|GABc|]\n[V:SYNTH] [CEG]4|[FAC]4|]",
      { playback: { tempo: 120, instruments: { LEAD: "acoustic_guitar_nylon", SYNTH: "string_ensemble_1" } } },
    );
    const result = normalizeAndLintScore(input);
    expect(result.score.abc).toContain("%%score { LEAD SYNTH }");
    expect(result.warnings.join(" ")).not.toContain("without a %%score grouping");

    const tune = ABCJS.parseOnly(result.score.abc)[0]!;
    expect(tune.lines.some((line) => line.staff?.length === 2)).toBe(true);
    const tracks = ABCJS.synth.sequence(tune, {});
    expect(tracks).toHaveLength(2);
    const firstTimings = tracks.map((track) => track.find((event) => event.el_type === "note")?.timing);
    expect(firstTimings).toEqual([0, 0]);
  });

  it("repairs an incomplete grouping rather than dropping or delaying a voice", () => {
    const result = normalizeAndLintScore(score(
      "X:1\nT:Trio\nM:4/4\nL:1/4\nQ:1/4=96\n%%score { A B }\nV:A\nV:B\nV:C\nK:C\n[V:A] C4|]\n[V:B] E4|]\n[V:C] G4|]",
    ));
    expect(result.score.abc).toContain("%%score { A B C }");
    expect(ABCJS.synth.sequence(ABCJS.parseOnly(result.score.abc)[0]!, {})).toHaveLength(3);
  });

  it("moves a complete score directive before voice declarations without losing grand-staff syntax", () => {
    const result = normalizeAndLintScore(score(
      "X:1\nT:Piano\nM:4/4\nL:1/4\nQ:1/4=96\nV:RH clef=treble\nV:LH clef=bass\n%%score { RH | LH }\nK:C\n[V:RH] C4|]\n[V:LH] C,4|]",
    ));

    expect(result.score.abc).toContain("Q:1/4=96\n%%score { RH | LH }\nV:RH");
    const tune = ABCJS.parseOnly(result.score.abc)[0]!;
    const staves = tune.lines[0]?.staff as Array<{ brace?: string }> | undefined;
    expect(staves?.[0]?.brace).toBe("start");
    expect(staves?.[1]?.brace).toBe("end");
  });

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

  it("does not double an octave transposition already realized by the clef", () => {
    const input = score(
      'X:1\nT:Guitar\nM:4/4\nL:1/4\nV:G clef=treble-8 name="Guitar" transpose=-12\nK:C\n[V:G] CDEF|]',
      {
        composition: {
          ...generatedComposition,
          ensemble: [{ voiceId: "G", instrument: "classical guitar", family: "guitar", role: "melody", kind: "pitched", transpositionSemitones: -12 }],
        },
      },
    );
    const result = normalizeAndLintScore(input);
    expect(result.score.abc).toContain('V:G clef=treble-8 name="Guitar"');
    expect(result.score.abc).not.toContain("transpose=");
    expect(ABCJS.parseOnly(result.score.abc)[0]?.lines[0]?.staff?.[0]?.clef?.type).toBe("treble-8");
  });

  it("keeps an inline octave-clef change attached to its section and audible", () => {
    const abc = 'X:1\nT:Section clef\nM:4/4\nL:1/4\nQ:1/4=96\nV:S clef=treble\nK:C\n[V:S] CDEF|[K:C clef=treble+8]CDEF|]';
    const tune = ABCJS.parseOnly(abc)[0]!;
    const voice = tune.lines[0]?.staff?.[0]?.voices?.[0];
    expect(voice).toBeDefined();
    const items = voice ?? [];
    const clefIndex = items.findIndex((item) => item.el_type === "clef");
    expect(items[clefIndex]).toMatchObject({ el_type: "clef", type: "treble+8" });
    expect(items.slice(clefIndex + 1).some((item) => item.el_type === "note")).toBe(true);
    expect(ABCJS.synth.sequence(tune, {})[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ el_type: "transpose", transpose: 12 }),
    ]));
  });
});

describe("ABC contract lint", () => {
  it("warns when a generated run of short notes has no beams at all", () => {
    const abc = "X:1\nT:Unbeamed\nM:4/4\nL:1/8\nQ:1/4=96\nK:C\nC D E F G A B c|]";
    const result = normalizeAndLintScore(score(abc, { composition: generatedComposition }));
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("four or more consecutive eighth-or-shorter notes with no beam grouping"),
    ]));
    expect(result.score.abc).toContain("C D E F G A B c|]");
  });

  it("accepts deliberate ABC beam groups and does not rewrite them", () => {
    const abc = "X:1\nT:Beamed\nM:4/4\nL:1/8\nQ:1/4=96\nK:C\nCDEF GABc|]";
    const result = normalizeAndLintScore(score(abc, { composition: generatedComposition }));
    expect(result.warnings.join(" ")).not.toContain("no beam grouping");
    expect(result.score.abc).toContain("CDEF GABc|]");
  });

  it("does not critique beaming in user-supplied ABC without a composition brief", () => {
    const abc = "X:1\nT:Syllabic source\nM:2/4\nL:1/8\nQ:1/4=80\nK:C\nC D E F|]";
    expect(normalizeAndLintScore(score(abc)).warnings.join(" ")).not.toContain("no beam grouping");
  });

  it("warns about missing descriptive headers without rejecting a render", () => {
    const result = normalizeAndLintScore(score("X:1\nK:C\nCDEF|"));
    expect(result.warnings).toContain("ABC header T: is missing.");
    expect(result.warnings).toContain("ABC header M: is missing.");
    expect(result.warnings).toContain("ABC header L: is missing.");
  });

  it("warns about unknown configuration and repairs unknown %%score voice IDs", () => {
    const input = score(
      "X:1\nT:Voices\nM:4/4\nL:1/4\nQ:1/4=96\nV:ONE clef=treble\nK:C\n%%score { ONE TWO }\n[V:ONE] CDEF|]",
      { playback: { instruments: { GHOST: "cello" } } },
    );
    const result = normalizeAndLintScore(input);
    const warnings = result.warnings;
    expect(warnings).toContain("Configuration references unknown voice GHOST.");
    expect(warnings.join(" ")).not.toContain("%%score references undeclared voice TWO.");
    expect(result.score.abc).toContain("%%score { ONE }");
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
