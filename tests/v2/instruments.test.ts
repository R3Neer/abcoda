import { describe, expect, it } from "vitest";
import {
  assessInstrumentRange,
  classifyInstrumentPitch,
  defaultInstrument,
  instrumentCatalog,
  instrumentDefinition,
  instrumentIds,
  instrumentRangeFit,
  instrumentsForVoice,
  isInstrumentCompatible,
  isInstrumentPitchPlayable,
} from "../../packages/domain/src/index";
import {
  instrumentIdSchema,
} from "../../packages/contracts/src/index";

describe("instrument policy", () => {
  it("keeps the wire contract synchronized with the domain catalog", () => {
    expect(instrumentIdSchema.options).toEqual(instrumentIds);
  });

  it("offers only instruments compatible with the voice notation kind", () => {
    expect(
      instrumentsForVoice(
        "unpitched_percussion",
      ).map(({ id }) => id),
    ).toEqual([
      "standard_drum_kit",
    ]);

    expect(
      instrumentsForVoice("pitched"),
    ).toHaveLength(
      instrumentCatalog.length - 1,
    );

    expect(
      isInstrumentCompatible(
        "pitched",
        "cello",
      ),
    ).toBe(true);

    expect(
      isInstrumentCompatible(
        "pitched",
        "standard_drum_kit",
      ),
    ).toBe(false);
  });

  it("selects safe defaults without leaking adapter-specific soundfont values", () => {
    expect(
      defaultInstrument("pitched"),
    ).toBe(
      "acoustic_grand_piano",
    );

    expect(
      defaultInstrument(
        "unpitched_percussion",
      ),
    ).toBe(
      "standard_drum_kit",
    );

    expect(
      instrumentDefinition(
        "standard_drum_kit",
      ).midiProgram,
    ).toBeUndefined();

    expect(
      instrumentDefinition(
        "cello",
      ).midiProgram,
    ).toBe(42);
  });

  it("keeps every usual range inside its playable range", () => {
    for (const instrument of instrumentCatalog) {
      expect(
        instrument.usualRange.min,
        `${instrument.id} usual minimum`,
      ).toBeGreaterThanOrEqual(
        instrument.playableRange.min,
      );

      expect(
        instrument.usualRange.max,
        `${instrument.id} usual maximum`,
      ).toBeLessThanOrEqual(
        instrument.playableRange.max,
      );
    }
  });

  it("classifies usual, extended, and unplayable pitches", () => {
    expect(
      classifyInstrumentPitch(
        67,
        "contrabass",
      ),
    ).toBe("usual");

    expect(
      classifyInstrumentPitch(
        68,
        "contrabass",
      ),
    ).toBe("extended");

    expect(
      classifyInstrumentPitch(
        72,
        "contrabass",
      ),
    ).toBe("extended");

    expect(
      classifyInstrumentPitch(
        73,
        "contrabass",
      ),
    ).toBe("unplayable");

    // The motivating case: A5 must never be requested as a
    // contrabass SoundFont sample.
    expect(
      classifyInstrumentPitch(
        81,
        "contrabass",
      ),
    ).toBe("unplayable");
  });

  it("treats playable boundaries as inclusive", () => {
    const contrabass =
      instrumentDefinition("contrabass");

    expect(
      isInstrumentPitchPlayable(
        contrabass.playableRange.min,
        "contrabass",
      ),
    ).toBe(true);

    expect(
      isInstrumentPitchPlayable(
        contrabass.playableRange.max,
        "contrabass",
      ),
    ).toBe(true);

    expect(
      isInstrumentPitchPlayable(
        contrabass.playableRange.min - 1,
        "contrabass",
      ),
    ).toBe(false);

    expect(
      isInstrumentPitchPlayable(
        contrabass.playableRange.max + 1,
        "contrabass",
      ),
    ).toBe(false);
  });

  it("aggregates severity with unplayable taking precedence over extended", () => {
    expect(
      assessInstrumentRange(
        [60, 70],
        "contrabass",
      ),
    ).toMatchObject({
      fit: "extended",
      usual: 1,
      extended: 1,
      unplayable: 0,
    });

    expect(
      assessInstrumentRange(
        [60, 70, 81],
        "contrabass",
      ),
    ).toMatchObject({
      fit: "unplayable",
      usual: 1,
      extended: 1,
      unplayable: 1,
    });

    expect(
      assessInstrumentRange(
        [],
        "contrabass",
      ).fit,
    ).toBe("empty");
  });

  it("preserves the current usual-range warning semantics until Patch B", () => {
    expect(
      instrumentRangeFit(
        [60, 72],
        "flute",
      ).fit,
    ).toBe("inside");

    expect(
      instrumentRangeFit(
        [40, 60],
        "flute",
      ),
    ).toMatchObject({
      fit: "partial",
      inside: 1,
      outside: 1,
    });

    expect(
      instrumentRangeFit(
        [40, 50],
        "flute",
      ).fit,
    ).toBe("outside");

    expect(
      instrumentRangeFit(
        [],
        "flute",
      ).fit,
    ).toBe("empty");
  });
});