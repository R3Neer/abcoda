import { describe, expect, it } from "vitest";
import { assessVoiceRanges } from "../../apps/widget/src/application/voice-range";
import type { VoiceMixSnapshot } from "../../apps/widget/src/application/voice-mix";

const mix: VoiceMixSnapshot = {
  revision: 1,
  voices: [
    { id: "FL", kind: "pitched", instrument: "flute", muted: false },
    { id: "DR", kind: "unpitched_percussion", instrument: "standard_drum_kit", muted: false },
  ],
};

describe("assessVoiceRanges", () => {
  it("reports only actionable partial and outside fits", () => {
    expect(assessVoiceRanges(mix, { FL: [40, 60], DR: [36, 42] })).toEqual([
      {
        voiceId: "FL",
        fit: "partial",
        message: "1 note outside the usual C4–D7 range.",
      },
      { voiceId: "DR", fit: "inside" },
    ]);
  });

  it("distinguishes a completely outside voice from one with no notes", () => {
    expect(assessVoiceRanges(mix, { FL: [40, 41] })).toEqual([
      {
        voiceId: "FL",
        fit: "outside",
        message: "All 2 notes are outside the usual C4–D7 range.",
      },
      { voiceId: "DR", fit: "empty" },
    ]);
  });
});
