import { describe, expect, it } from "vitest";
import { VoiceMixController } from "../../apps/widget/src/application/voice-mix";

describe("VoiceMixController", () => {
  it("adopts compatible host defaults without overriding later local choices", () => {
    const mix = new VoiceMixController(() => undefined);
    mix.adoptVoices(
      1,
      [
        { id: "LEAD", kind: "pitched" },
        { id: "DR", kind: "unpitched_percussion" },
      ],
      {
        instruments: { LEAD: "cello", DR: "standard_drum_kit" },
        mutedVoices: ["DR"],
      },
    );
    mix.setInstrument("LEAD", "violin");
    mix.adoptVoices(2, [{ id: "LEAD", kind: "pitched" }], {
      instruments: { LEAD: "cello" },
    });

    expect(mix.snapshot().voices).toEqual([
      { id: "LEAD", kind: "pitched", instrument: "violin", muted: false },
    ]);
  });

  it("creates compatible defaults and retains voice-local choices by stable id", () => {
    const states: unknown[] = [];
    const mix = new VoiceMixController((state) => states.push(state));
    mix.adoptVoices(4, [
      { id: "RH", kind: "pitched" },
      { id: "DR", kind: "unpitched_percussion" },
    ]);
    mix.setInstrument("RH", "cello");
    mix.setMuted("DR", true);
    mix.adoptVoices(5, [
      { id: "RH", kind: "pitched" },
      { id: "NEW", kind: "pitched" },
      { id: "DR", kind: "unpitched_percussion" },
    ]);

    expect(mix.snapshot()).toEqual({
      revision: 5,
      voices: [
        { id: "RH", kind: "pitched", instrument: "cello", muted: false },
        { id: "NEW", kind: "pitched", instrument: "acoustic_grand_piano", muted: false },
        { id: "DR", kind: "unpitched_percussion", instrument: "standard_drum_kit", muted: true },
      ],
    });
    expect(states.length).toBeGreaterThan(1);
  });

  it("repairs a retained assignment when a voice changes notation kind", () => {
    const mix = new VoiceMixController(() => undefined);
    mix.adoptVoices(1, [{ id: "PART", kind: "pitched" }]);
    mix.setInstrument("PART", "violin");
    mix.adoptVoices(2, [{ id: "PART", kind: "unpitched_percussion" }]);

    expect(mix.snapshot().voices[0]).toMatchObject({
      instrument: "standard_drum_kit",
      kind: "unpitched_percussion",
    });
  });

  it("rejects unknown voices and incompatible instruments", () => {
    const mix = new VoiceMixController(() => undefined);
    mix.adoptVoices(1, [{ id: "DR", kind: "unpitched_percussion" }]);

    expect(() => mix.setInstrument("DR", "flute")).toThrow(/incompatible/);
    expect(() => mix.setMuted("GHOST", true)).toThrow(/Unknown voice/);
  });

  it("does not publish no-op changes", () => {
    let publications = 0;
    const mix = new VoiceMixController(() => { publications += 1; });
    mix.adoptVoices(1, [{ id: "ONE", kind: "pitched" }]);
    const before = publications;
    mix.setInstrument("ONE", "acoustic_grand_piano");
    mix.setMuted("ONE", false);
    expect(publications).toBe(before);
  });
});
