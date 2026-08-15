import { describe, expect, it } from "vitest";
import {
  assessInstrumentPitches,
  classifyInstrumentPitch,
  defaultInstrument,
  instrumentCatalog,
  instrumentDefinition,
  instrumentIds,
  instrumentsForVoice,
  isInstrumentCompatible,
} from "../../packages/domain/src/index";
import { instrumentIdSchema } from "../../packages/contracts/src/index";

describe("instrument policy", () => {
  it("keeps the wire contract synchronized with the domain catalog", () => {
    expect(instrumentIdSchema.options).toEqual(instrumentIds);
  });

  it("offers only instruments compatible with the voice notation kind", () => {
    expect(instrumentsForVoice("unpitched_percussion").map(({ id }) => id)).toEqual([
      "standard_drum_kit",
    ]);
    expect(instrumentsForVoice("pitched")).toHaveLength(instrumentCatalog.length - 1);
    expect(isInstrumentCompatible("pitched", "cello")).toBe(true);
    expect(isInstrumentCompatible("pitched", "standard_drum_kit")).toBe(false);
  });

  it("selects safe defaults without leaking adapter-specific soundfont values", () => {
    expect(defaultInstrument("pitched")).toBe("acoustic_grand_piano");
    expect(defaultInstrument("unpitched_percussion")).toBe("standard_drum_kit");
    expect(instrumentDefinition("standard_drum_kit").midiProgram).toBeUndefined();
    expect(instrumentDefinition("cello").midiProgram).toBe(42);
  });

  it("keeps every usual pitched range inside its hard playable boundary", () => {
    for (const instrument of instrumentCatalog) {
      if (instrument.voiceKind !== "pitched") continue;
      expect(instrument.usualRange.min).toBeGreaterThanOrEqual(instrument.playableRange.min);
      expect(instrument.usualRange.max).toBeLessThanOrEqual(instrument.playableRange.max);
    }
  });

  it("classifies usual, extended, and unplayable pitches independently", () => {
    expect(classifyInstrumentPitch(84, "trumpet")).toBe("usual");
    expect(classifyInstrumentPitch(86, "trumpet")).toBe("extended");
    expect(classifyInstrumentPitch(88, "trumpet")).toBe("unplayable");

    expect(assessInstrumentPitches([84, 86], "trumpet")).toMatchObject({
      status: "extended",
      usual: 1,
      extended: 1,
      unplayable: 0,
    });
    expect(assessInstrumentPitches([84, 88], "trumpet")).toMatchObject({
      status: "unplayable",
      usual: 1,
      extended: 0,
      unplayable: 1,
    });
    expect(assessInstrumentPitches([], "trumpet").status).toBe("empty");
  });

  it("does not pretend percussion uses melodic range semantics", () => {
    expect(() => classifyInstrumentPitch(60, "standard_drum_kit")).toThrow(
      "does not use melodic range classification",
    );
  });
});
