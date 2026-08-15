import { describe, expect, it } from "vitest";
import {
  buildCompositionPlan,
  compositionBriefSchema,
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
    for (const styleFamily of styleFamilies) expect(plan({ styleFamily }).guidance.style.length).toBeGreaterThan(0);
    for (const formFamily of formFamilies) expect(plan({ formFamily }).guidance.form.length).toBeGreaterThan(2);
    for (const pitchFramework of pitchFrameworks) expect(plan({ pitchFramework }).guidance.pitch.length).toBeGreaterThan(1);
    for (const rhythmicFeel of rhythmicFeels) expect(plan({ rhythmicFeel }).guidance.rhythm.length).toBeGreaterThan(2);
    for (const texture of textureModels) expect(plan({ texture }).guidance.texture.length).toBeGreaterThan(1);
    for (const difficulty of difficultyLevels) expect(plan({ difficulty }).guidance.difficultyAndIntent.length).toBeGreaterThan(2);
    for (const intent of compositionIntents) expect(plan({ intent }).guidance.difficultyAndIntent.length).toBeGreaterThan(2);
    for (const family of instrumentFamilies) {
      expect(plan({ ensemble: [{ ...base.ensemble[0]!, family }] }).guidance.instruments.length).toBeGreaterThan(2);
    }
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
      expect(result.prompt).toContain("SILENT PREFLIGHT");
      expect(result.prompt.length).toBeLessThan(15_000);
    }
    expect(combinations).toHaveLength(576);
  });
});
