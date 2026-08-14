import { describe, expect, it } from "vitest";
import { buildCompositionPlan, compositionBriefSchema } from "../shared/composition-plan";

const base = {
  form: "AABA",
  measures: 32,
  meter: "4/4",
  tempo: 112,
  pitchLanguage: "F mixolydian with blues inflections",
  difficulty: "intermediate" as const,
  intent: "performance" as const,
  ensemble: [
    { voiceId: "LEAD", instrument: "electric guitar", role: "melody" as const, kind: "pitched" as const },
    { voiceId: "BASS", instrument: "electric bass", role: "bass" as const, kind: "pitched" as const },
    { voiceId: "DR", instrument: "drum kit", role: "beat" as const, kind: "unpitched_percussion" as const },
  ],
  constraints: ["syncopated hook"],
};

describe("tailored composition plans", () => {
  it("routes pop to layers and groove instead of classical voice-leading", () => {
    const brief = compositionBriefSchema.parse({ ...base, styleFamily: "pop_rock_funk_rnb" });
    const plan = buildCompositionPlan(brief);
    expect(plan.prompt).toContain("functional layers");
    expect(plan.prompt).toContain("stable groove");
    expect(plan.prompt).not.toContain("subject, answer, companion/countersubject");
  });

  it("adds percussion notation instructions only when typed", () => {
    const withDrums = buildCompositionPlan(compositionBriefSchema.parse({ ...base, styleFamily: "jazz_blues" }));
    expect(withDrums.guidance.notation.join(" ")).toContain("DR");
    expect(withDrums.guidance.notation.join(" ")).toContain("unpitched_percussion");

    const withoutDrums = buildCompositionPlan(compositionBriefSchema.parse({
      ...base,
      styleFamily: "classical",
      ensemble: base.ensemble.slice(0, 2),
    }));
    expect(withoutDrums.guidance.notation.join(" ")).toContain("voiceKinds={}");
  });
});
