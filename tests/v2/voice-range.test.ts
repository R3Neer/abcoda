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
  it("distinguishes extended writing from hard unplayable pitches", () => {
    expect(assessVoiceRanges(mix, { FL: [60, 98], DR: [36, 42] })).toEqual([
      {
        voiceId: "FL",
        status: "extended",
        message: "Some notes are outside the usual C4–C7 range but remain within the playable C4–D7 range.",
      },
      { voiceId: "DR", status: "not_applicable" },
    ]);

    expect(assessVoiceRanges(mix, { FL: [60, 99] })[0]).toEqual({
      voiceId: "FL",
      status: "unplayable",
      message: "Some notes are outside the usual C4–C7 range and exceed the playable C4–D7 range. Notes outside the playable range are shown in red and played silently.",
    });
  });

  it("keeps empty pitched voices separate from percussion", () => {
    expect(assessVoiceRanges(mix, {})).toEqual([
      { voiceId: "FL", status: "empty" },
      { voiceId: "DR", status: "not_applicable" },
    ]);
  });
});
