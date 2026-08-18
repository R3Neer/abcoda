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

  it("keeps every bounded usual range inside its hard playable boundary", () => {
    for (const instrument of instrumentCatalog) {
      if (instrument.voiceKind !== "pitched") continue;
      if (instrument.rangePolicy.kind !== "bounded") continue;
      expect(instrument.rangePolicy.usualRange.min).toBeGreaterThanOrEqual(
        instrument.rangePolicy.playableRange.min,
      );
      expect(instrument.rangePolicy.usualRange.max).toBeLessThanOrEqual(
        instrument.rangePolicy.playableRange.max,
      );
    }
  });

  it("classifies usual, extended, and unplayable pitches independently", () => {
    expect(classifyInstrumentPitch(84, "trumpet")).toBe("usual");
    expect(classifyInstrumentPitch(89, "trumpet")).toBe("extended");
    expect(classifyInstrumentPitch(90, "trumpet")).toBe("unplayable");

    expect(assessInstrumentPitches([84, 89], "trumpet")).toMatchObject({
      policy: "bounded",
      status: "extended",
      usual: 1,
      extended: 1,
      unplayable: 0,
    });
    expect(assessInstrumentPitches([84, 90], "trumpet")).toMatchObject({
      policy: "bounded",
      status: "unplayable",
      usual: 1,
      extended: 0,
      unplayable: 1,
    });
    expect(assessInstrumentPitches([], "trumpet").status).toBe("empty");
  });

  it("keeps ambiguous presets out of fabricated hard-range enforcement", () => {
    for (const instrument of [
      "church_organ",
      "string_ensemble_1",
      "choir_aahs",
      "recorder",
    ] as const) {
      expect(instrumentDefinition(instrument)).toMatchObject({
        rangePolicy: { kind: "unbounded" },
      });
      expect(classifyInstrumentPitch(127, instrument)).toBe("unbounded");
      expect(assessInstrumentPitches([0, 127], instrument)).toEqual({
        policy: "unbounded",
        status: "unbounded",
        usual: 0,
        extended: 0,
        unplayable: 0,
      });
    }
  });

  it("does not pretend percussion uses melodic range semantics", () => {
    expect(instrumentDefinition("standard_drum_kit")).toMatchObject({
      rangePolicy: {
        kind: "percussion",
        noteRange: { min: 35, max: 81 },
      },
    });
    expect(() => classifyInstrumentPitch(60, "standard_drum_kit")).toThrow(
      "does not use melodic range classification",
    );
  });
});
