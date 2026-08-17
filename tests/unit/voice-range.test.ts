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
    expect(assessVoiceRanges(mix, { FL: [59, 100], DR: [36, 42] })).toEqual([
      {
        voiceId: "FL",
        status: "extended",
        message: "Some notes are outside the usual B3–D7 range but remain within the playable B3–F7 range.",
      },
      { voiceId: "DR", status: "not_applicable" },
    ]);

    expect(assessVoiceRanges(mix, { FL: [59, 102] })[0]).toEqual({
      voiceId: "FL",
      status: "unplayable",
      message: "Some notes are outside the usual B3–D7 range and exceed the playable B3–F7 range. Notes outside the playable range are shown in red and played silently.",
    });
  });

  it("keeps unbounded pitched presets separate from percussion", () => {
    const unboundedMix: VoiceMixSnapshot = {
      revision: 2,
      voices: [
        { id: "CHOIR", kind: "pitched", instrument: "choir_aahs", muted: false },
        { id: "DR", kind: "unpitched_percussion", instrument: "standard_drum_kit", muted: false },
      ],
    };

    expect(assessVoiceRanges(unboundedMix, { CHOIR: [24, 108] })).toEqual([
      { voiceId: "CHOIR", status: "unbounded" },
      { voiceId: "DR", status: "not_applicable" },
    ]);
  });

  it("keeps empty pitched voices separate from percussion", () => {
    expect(assessVoiceRanges(mix, {})).toEqual([
      { voiceId: "FL", status: "empty" },
      { voiceId: "DR", status: "not_applicable" },
    ]);
  });
});
