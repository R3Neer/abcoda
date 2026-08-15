import { describe, expect, it } from "vitest";
import {
  defaultInstrument,
  instrumentCatalog,
  instrumentDefinition,
  instrumentRangeFit,
  instrumentsForVoice,
  isInstrumentCompatible,
} from "../../packages/domain/src/index";

describe("instrument policy", () => {
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

  it("classifies full, partial, absent, and empty range coverage", () => {
    expect(instrumentRangeFit([60, 72], "flute").fit).toBe("inside");
    expect(instrumentRangeFit([40, 60], "flute")).toMatchObject({
      fit: "partial",
      inside: 1,
      outside: 1,
    });
    expect(instrumentRangeFit([40, 50], "flute").fit).toBe("outside");
    expect(instrumentRangeFit([], "flute").fit).toBe("empty");
  });
});
