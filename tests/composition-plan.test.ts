import { describe, expect, it } from "vitest";
import {
  buildCompositionPlan,
  compositionBriefSchema,
  compositionEffortLevels,
  compositionIntents,
  compositionPlanOutputSchema,
  difficultyLevels,
  formFamilies,
  instrumentFamilies,
  pitchFrameworks,
  rhythmicFeels,
  styleFamilies,
  textureModels,
  type CompositionBrief,
} from "../shared/composition-plan";
import { renderScoreInputSchema } from "../shared/score";

const base: CompositionBrief = compositionBriefSchema.parse({
  styleFamily: "classical",
  styleDetail: "late eighteenth-century chamber idiom",
  formFamily: "period",
  form: "parallel period with a varied consequent",
  sectionPlan: [],
  measures: 8,
  meter: "4/4",
  tempo: 96,
  rhythmicFeel: "straight",
  pitchFramework: "tonal_functional",
  pitchLanguage: "C major with a half cadence and authentic close",
  texture: "melody_accompaniment",
  difficulty: "intermediate",
  effort: "standard",
  intent: "performance",
  ensemble: [{
    voiceId: "P1",
    instrument: "piano",
    family: "keyboard",
    role: "melody",
    kind: "pitched",
    transpositionSemitones: 0,
  }],
  constraints: [],
  departures: [],
});

function plan(overrides: Partial<CompositionBrief> = {}) {
  return buildCompositionPlan(compositionBriefSchema.parse({ ...base, ...overrides }));
}

describe("tailored composition plans", () => {
  it("combines Baroque fugue, contrapuntal texture, and tonal rules without pop defaults", () => {
    const result = plan({
      styleFamily: "baroque",
      styleDetail: "two-part invention",
      formFamily: "fugue_invention",
      form: "subject, answer, episode, return",
      texture: "contrapuntal",
    });
    expect(result.prompt).toContain("subject length/profile");
    expect(result.prompt).toContain("imitation, sequence");
    expect(result.prompt).toContain("independent contour and rhythm");
    expect(result.prompt).not.toContain("functional layers");
  });

  it("combines coloristic style, ternary form, symmetric pitch, rubato, and color-mass texture", () => {
    const result = plan({
      styleFamily: "impressionist_coloristic",
      formFamily: "ternary",
      form: "A–B–A′ nocturne",
      pitchFramework: "symmetric_collection",
      pitchLanguage: "octatonic collection alternating with whole tone",
      rhythmicFeel: "rubato_flexible",
      texture: "color_mass",
    });
    expect(result.prompt).toContain("planing");
    expect(result.prompt).toContain("A–B–A");
    expect(result.prompt).toContain("limited transpositions");
    expect(result.prompt).toContain("sonority through register, spacing, doubling");
  });

  it("combines pop vocabulary with verse-chorus, cyclic harmony, groove, and layered roles", () => {
    const result = plan({
      styleFamily: "pop_rock_funk_rnb",
      formFamily: "verse_chorus",
      form: "verse, pre-chorus, chorus, verse, chorus",
      pitchFramework: "tonal_cyclic",
      pitchLanguage: "four-chord loop in E major",
      rhythmicFeel: "syncopated_groove",
      texture: "layered_groove",
    });
    expect(result.prompt).toContain("memorable hook");
    expect(result.prompt).toContain("verse and chorus by function");
    expect(result.prompt).toContain("repeating root-position or loop-based progression");
    expect(result.prompt).toContain("beat, bass, harmonic filler, melody");
  });

  it("keeps twelve-tone pitch organisation separate from canonic form", () => {
    const result = plan({
      styleFamily: "atonal_post_tonal",
      formFamily: "canon",
      form: "canon at the tritone after two bars",
      pitchFramework: "twelve_tone",
      pitchLanguage: "P0 = 0,1,4,2,7,8,3,9,5,11,6,10",
      texture: "contrapuntal",
    });
    expect(result.prompt).toContain("delay, interval, direction, transformation");
    expect(result.prompt).toContain("prime, inversion, retrograde");
    expect(result.prompt).not.toContain("prepare predominant/dominant motion");
  });

  it("flags underspecified tradition claims and incompatible percussion typing", () => {
    const result = plan({
      styleFamily: "folk_traditional_dance",
      styleDetail: undefined,
      formFamily: "dance",
      form: "three repeated strains",
      rhythmicFeel: "asymmetric_additive",
      meter: "7/8 (2+2+3)",
      ensemble: [{
        voiceId: "DR",
        instrument: "drum kit",
        family: "drum_kit",
        role: "beat",
        kind: "pitched",
        transpositionSemitones: 0,
      }],
    });
    expect(result.compatibilityNotes).toEqual(expect.arrayContaining([
      expect.stringContaining("kind=pitched"),
      expect.stringContaining("No specific tradition"),
    ]));
    expect(result.prompt).toContain("grouped/additive");
  });

  it("reports a section-plan measure mismatch", () => {
    const result = plan({
      measures: 16,
      sectionPlan: [
        { label: "A", measures: 8, function: "presentation" },
        { label: "B", measures: 6, function: "contrast and close" },
      ],
    });
    expect(result.guidance.form.join(" ")).toContain("totals 14 bars while the target is 16");
  });

  it("honours typed constraints and departures before defaults", () => {
    const result = plan({
      constraints: ["exactly eight written bars"],
      departures: ["end on an unresolved dominant"],
    });
    expect(result.guidance.priorities[0]).toContain("exactly eight written bars");
    expect(result.guidance.priorities[1]).toContain("end on an unresolved dominant");
  });
});

describe("prompt coverage matrix", () => {
  it("gives every selector at least one dedicated, nonempty module", () => {
    for (const styleFamily of styleFamilies) {
      expect(plan({ styleFamily }).guidance.style.length).toBeGreaterThan(0);
      expect(plan({ styleFamily }).review.meso.length).toBeGreaterThan(0);
    }
    for (const formFamily of formFamilies) {
      expect(plan({ formFamily }).guidance.form.length).toBeGreaterThan(2);
      expect(plan({ formFamily }).review.macro.length).toBeGreaterThan(0);
    }
    for (const pitchFramework of pitchFrameworks) {
      expect(plan({ pitchFramework }).guidance.pitch.length).toBeGreaterThan(1);
      expect(plan({ pitchFramework }).review.meso.length).toBeGreaterThan(0);
    }
    for (const rhythmicFeel of rhythmicFeels) {
      expect(plan({ rhythmicFeel }).guidance.rhythm.length).toBeGreaterThan(2);
      expect(plan({ rhythmicFeel }).review.local.length).toBeGreaterThan(0);
    }
    for (const texture of textureModels) {
      expect(plan({ texture }).guidance.texture.length).toBeGreaterThan(1);
      expect(plan({ texture }).review.meso.length).toBeGreaterThan(0);
    }
    for (const difficulty of difficultyLevels) expect(plan({ difficulty }).guidance.difficultyAndIntent.length).toBeGreaterThan(2);
    for (const intent of compositionIntents) expect(plan({ intent }).guidance.difficultyAndIntent.length).toBeGreaterThan(2);
    for (const family of instrumentFamilies) {
      expect(plan({ ensemble: [{ ...base.ensemble[0]!, family }] }).guidance.instruments.length).toBeGreaterThan(2);
      expect(plan({ ensemble: [{ ...base.ensemble[0]!, family }] }).review.local.length).toBeGreaterThan(0);
    }
    for (const effort of compositionEffortLevels) expect(plan({ effort }).review.strategy.length).toBeGreaterThan(0);
  });

  it("produces a valid, coherent prompt for every pair of major selectors", () => {
    const combinations: Array<Partial<CompositionBrief>> = [];
    for (const styleFamily of styleFamilies) {
      for (const formFamily of formFamilies) combinations.push({ styleFamily, formFamily });
      for (const pitchFramework of pitchFrameworks) combinations.push({ styleFamily, pitchFramework });
      for (const rhythmicFeel of rhythmicFeels) combinations.push({ styleFamily, rhythmicFeel });
      for (const texture of textureModels) combinations.push({ styleFamily, texture });
    }

    for (const values of combinations) {
      const result = plan(values);
      expect(() => compositionPlanOutputSchema.parse(result)).not.toThrow();
      expect(result.prompt).not.toMatch(/\b(?:undefined|null)\b/);
      expect(result.prompt).toContain("PRIORITIES AND CONFLICT RESOLUTION");
      expect(result.prompt).toContain("FORM AND DEVELOPMENT");
      expect(result.prompt).toContain("PITCH AND HARMONY");
      expect(result.prompt).toContain("RHYTHM AND METER");
      expect(result.prompt).toContain("TEXTURE");
      expect(result.prompt).toContain("INSTRUMENTS AND VOICES");
      expect(result.prompt).toContain("SILENT HIERARCHICAL REVIEW STRATEGY");
      expect(result.prompt).toContain("MECHANICAL ABC PREFLIGHT");
      expect(result.prompt.length).toBeLessThan(18_000);
    }
    expect(combinations).toHaveLength(576);
  });
});

describe("effort-aware musical review", () => {
  it("defaults effort to standard and accepts every declared level", () => {
    const { effort: _effort, ...withoutEffort } = base;
    expect(compositionBriefSchema.parse(withoutEffort).effort).toBe("standard");
    for (const effort of compositionEffortLevels) {
      expect(compositionBriefSchema.parse({ ...base, effort }).effort).toBe(effort);
    }
  });

  it("rejects invalid effort values", () => {
    expect(() => compositionBriefSchema.parse({ ...base, effort: "heroic" })).toThrow();
  });

  it("keeps performer difficulty independent from composition effort", () => {
    const result = plan({ difficulty: "beginner", effort: "exhaustive" });
    expect(result.brief).toMatchObject({ difficulty: "beginner", effort: "exhaustive" });
    expect(result.guidance.difficultyAndIntent.join(" ")).toContain("beginner");
    expect(result.review.strategy.join(" ")).toContain("FINAL HOLISTIC AUDIT");
  });

  it("renders musical layers coarse-to-fine before mechanical preflight", () => {
    const prompt = plan({ effort: "careful" }).prompt;
    const headings = [
      "L1 — MACRO / ARCHITECTURE",
      "L2 — DEVELOPMENT / MESO",
      "L3 — LOCAL MUSICAL",
      "L4 — PERFORMANCE / EXPRESSION",
      "MECHANICAL ABC PREFLIGHT",
    ];
    const positions = headings.map((heading) => prompt.indexOf(heading));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });

  it("uses a brief integrated check for quick effort", () => {
    const result = plan({ effort: "quick" });
    expect(result.review.strategy.join(" ")).toContain("light MACRO sanity check");
    expect(result.review.meso).toEqual([]);
    expect(result.review.performance).toEqual([]);
    expect(result.review.finalHolisticAudit).toEqual([]);
    expect(result.prompt).toContain("L1 — MACRO / ARCHITECTURE");
    expect(result.prompt).toContain("L3 — LOCAL MUSICAL");
    expect(result.prompt).not.toContain("L2 — DEVELOPMENT / MESO");
    expect(result.prompt).not.toContain("L4 — PERFORMANCE / EXPRESSION");
  });

  it("uses normal material/form and playability review for standard effort", () => {
    const result = plan({ effort: "standard" });
    expect(result.review.strategy.join(" ")).toContain("MACRO → DEVELOPMENT/MESO → LOCAL MUSICAL → PERFORMANCE/EXPRESSION");
    expect(result.review.strategy.join(" ")).toContain("at least one layer back");
  });

  it("uses all hierarchical layers and permits substantive rewriting for careful effort", () => {
    const result = plan({ effort: "careful" });
    expect(result.review.strategy.join(" ")).toContain("Backtracking is mandatory");
    expect(result.review.strategy.join(" ")).toContain("The first draft is not sacred");
    expect(result.review.strategy.join(" ")).toContain("complete sections");
    expect(result.review.macro.length).toBeGreaterThan(0);
    expect(result.review.meso.length).toBeGreaterThan(0);
    expect(result.review.local.length).toBeGreaterThan(0);
    expect(result.review.performance.length).toBeGreaterThan(0);
  });

  it("adds a final holistic audit after convergence and real reconstruction for exhaustive effort", () => {
    const result = plan({ effort: "exhaustive" });
    const strategy = result.review.strategy.join(" ");
    expect(strategy).toContain("until every musical layer converges");
    expect(strategy).toContain("FINAL HOLISTIC AUDIT");
    expect(strategy).toContain("Rebuild phrases");
    expect(strategy).toContain("complete sections");
    expect(result.review.meso.join(" ")).toContain("bar-filling passage");
    expect(result.review.finalHolisticAudit.join(" ")).toContain("After all layers converge");
    const finalAuditHeading = result.prompt.lastIndexOf("FINAL HOLISTIC AUDIT");
    expect(result.prompt.indexOf("L4 — PERFORMANCE / EXPRESSION")).toBeLessThan(finalAuditHeading);
    expect(finalAuditHeading).toBeLessThan(result.prompt.indexOf("MECHANICAL ABC PREFLIGHT"));
  });

  it("routes Romantic failure modes without importing jazz criteria", () => {
    const review = plan({ styleFamily: "romantic" }).review.meso.join(" ");
    expect(review).toContain("excessively square");
    expect(review).toContain("unprepared climax");
    expect(review).not.toContain("guide-tone");
  });

  it("does not repair coloristic writing toward common-practice defaults", () => {
    const review = plan({ styleFamily: "impressionist_coloristic" }).review.meso.join(" ");
    expect(review).toContain("Do not penalise parallel motion");
    expect(review).toContain("common-practice voice leading");
  });

  it("judges minimalist repetition by audible process rather than novelty", () => {
    const review = plan({ styleFamily: "minimalist_electronic_cinematic" }).review.meso.join(" ");
    expect(review).toContain("Do not treat repetition itself as a defect");
    expect(review).toContain("process");
  });

  it("does not impose tonal cadences on post-tonal music", () => {
    const review = plan({ styleFamily: "atonal_post_tonal" }).review.meso.join(" ");
    expect(review).toContain("Do not demand tonal cadences");
  });

  it("routes functional form review for ternary and sentence", () => {
    const ternary = plan({ formFamily: "ternary" }).review.macro.join(" ");
    expect(ternary).toContain("B provides substantive contrast");
    expect(ternary).toContain("return");
    const sentence = plan({ formFamily: "sentence" }).review.macro.join(" ");
    expect(sentence).toContain("presentation");
    expect(sentence).toContain("continuation becomes more processive");
  });

  it("includes review only for instrument families that are present", () => {
    const guitar = plan({ ensemble: [{ ...base.ensemble[0]!, instrument: "guitar", family: "guitar" }] }).review.local.join(" ");
    expect(guitar).toContain("fretboard positions");
    expect(guitar).not.toContain("register breaks/colour");
    const mixed = plan({ ensemble: [
      { ...base.ensemble[0]!, instrument: "guitar", family: "guitar" },
      { ...base.ensemble[0]!, voiceId: "FL", instrument: "flute", family: "woodwind" },
    ] }).review.local.join(" ");
    expect(mixed).toContain("fretboard positions");
    expect(mixed).toContain("register breaks/colour");
  });

  it("keeps mechanical ABC preflight separate and after musical review", () => {
    const result = plan({ effort: "careful" });
    const preflight = result.guidance.preflight.join(" ");
    expect(preflight).toContain("X/T/M/L/Q/K order");
    expect(preflight).toContain("V:/%%score IDs");
    expect(preflight).not.toContain("motif/hook identity");
    expect(result.prompt.indexOf("L4 — PERFORMANCE / EXPRESSION")).toBeLessThan(result.prompt.indexOf("MECHANICAL ABC PREFLIGHT"));
  });

  it("encodes meter-aware beams through deliberate ABC whitespace", () => {
    const result = plan({ meter: "6/8", rhythmicFeel: "dance_pattern" });
    expect(result.guidance.notation.join(" ")).toContain("whitespace breaks the beam");
    expect(result.guidance.notation.join(" ")).toContain("dotted beats in compound meter");
    expect(result.review.local.join(" ")).toContain("Inspect the engraved beam groups");
    expect(result.guidance.preflight.join(" ")).toContain("beam grouping is encoded through deliberate ABC whitespace");
  });

  it("keeps basic articulation available in a quick beginner sketch without over-notating it", () => {
    const notation = plan({ difficulty: "beginner", effort: "quick", intent: "sketch" }).guidance.notation.join(" ");
    expect(notation).toContain("!staccato!");
    expect(notation).toContain("Do not mark every note by habit");
    expect(notation).not.toContain("!crescendo(!");
    expect(notation).not.toContain('"_Ped."');
  });

  it("adds dynamics and idiomatic visible pedal from standard/intermediate Romantic piano onward", () => {
    const result = plan({ styleFamily: "romantic", styleDetail: "lyrical nocturne", difficulty: "intermediate", effort: "standard" });
    const notation = result.guidance.notation.join(" ");
    expect(notation).toContain("!crescendo(!");
    expect(notation).toContain('"_Ped."');
    expect(notation).toContain("does not yet reproduce these pedal changes in audio");
    expect(result.review.performance.join(" ")).toContain("Rehearse the piano pedal plan");
  });

  it("lets exhaustive effort fully notate an easy piano piece without raising performer difficulty", () => {
    const notation = plan({ styleFamily: "impressionist_coloristic", difficulty: "beginner", effort: "exhaustive" }).guidance.notation.join(" ");
    expect(notation).toContain("Keep beginner pedalling sparse");
    expect(notation).toContain("complete performance-mark audit");
    expect(notation).toContain("!glissando(!");
  });

  it("does not prescribe sustain pedal for dry historical keyboard writing or non-piano keyboards", () => {
    const baroquePiano = plan({ styleFamily: "baroque", styleDetail: "two-part invention" }).guidance.notation.join(" ");
    expect(baroquePiano).toContain("Do not add sustain pedal merely because the instrument is piano");
    expect(baroquePiano).not.toContain('"_Ped."');
    const organ = plan({ ensemble: [{ ...base.ensemble[0]!, instrument: "church organ" }] }).guidance.notation.join(" ");
    expect(organ).not.toMatch(/Ped\.|sustain pedal/);
  });

  it("routes expressive notation by instrument family", () => {
    const guitar = plan({ ensemble: [{ ...base.ensemble[0]!, instrument: "guitar", family: "guitar" }] }).guidance.notation.join(" ");
    expect(guitar).toContain("fretted/plucked parts");
    expect(guitar).toContain("!arpeggio!");
    const flute = plan({ ensemble: [{ ...base.ensemble[0]!, instrument: "flute", family: "woodwind" }] }).guidance.notation.join(" ");
    expect(flute).toContain("!breath!");
    const drums = plan({ ensemble: [{ ...base.ensemble[0]!, instrument: "drum kit", family: "drum_kit", kind: "unpitched_percussion" }] }).guidance.notation.join(" ");
    expect(drums).toContain("sustained hairpin needs an actual roll");
    expect(drums).not.toContain('"_Ped."');
  });

  it("routes idiomatic octave clefs and safe section clef changes", () => {
    const result = plan({
      ensemble: [{ ...base.ensemble[0]!, voiceId: "GTR", instrument: "classical guitar", family: "guitar", transpositionSemitones: -12 }],
    });
    const instruments = result.guidance.instruments.join(" ");
    const notation = result.guidance.notation.join(" ");
    expect(instruments).toContain("clef=treble-8");
    expect(notation).toContain("[K:<current-key> clef=<new-clef>]");
    expect(notation).toContain("abcjs applies the octave to audio too");
    expect(notation).toContain("prevent a double shift");
    expect(result.guidance.preflight.join(" ")).toContain("octave-clef versus transpose accounting");
  });

  it("keeps compatibility notes and emits schema v4", () => {
    const result = plan({
      styleFamily: "atonal_post_tonal",
      pitchFramework: "tonal_functional",
    });
    expect(result.schemaVersion).toBe(4);
    expect(result.compatibilityNotes.join(" ")).toContain("intentional hybrid");
  });

  it("passes the same complete brief to render_score.composition", () => {
    const result = plan({ difficulty: "beginner", effort: "exhaustive" });
    const renderInput = renderScoreInputSchema.parse({
      abc: "X:1\nT:Test\nM:4/4\nL:1/4\nQ:1/4=96\nK:C\nC D E F|]",
      composition: result.brief,
    });
    expect(renderInput.composition).toEqual(result.brief);
  });

  it("keeps quick prompts materially smaller than exhaustive prompts", () => {
    const quick = plan({ effort: "quick" }).prompt;
    const exhaustive = plan({ effort: "exhaustive" }).prompt;
    expect(quick.length).toBeLessThan(exhaustive.length);
  });
});
