import { describe, expect, it } from "vitest";
import { renderScoreInputSchema } from "../shared/score";
import { abcTitle, extractVoiceIds } from "../shared/voices";
import { applyInstruments } from "../web/src/music";

describe("score contract", () => {
  it("fills lightweight playback defaults", () => {
    const parsed = renderScoreInputSchema.parse({ abc: "X:1\nK:C\nCDEF|" });
    expect(parsed.playback.tempo).toBe(96);
    expect(parsed.playback.instruments).toEqual({});
    expect(parsed.schemaVersion).toBe(1);
  });

  it("rejects unsafe score sizes and impossible tempi", () => {
    expect(() => renderScoreInputSchema.parse({ abc: "X:1\nK:C\nC|", playback: { tempo: 500 } })).toThrow();
    expect(() => renderScoreInputSchema.parse({ abc: "" })).toThrow();
  });
});

describe("ABC metadata", () => {
  it("extracts declared and inline voices without duplicates", () => {
    const abc = "X:1\nT:Duet\nV:RH clef=treble\nV:LH clef=bass\n[V:RH] C4|";
    expect(extractVoiceIds(abc)).toEqual(["RH", "LH"]);
    expect(abcTitle(abc)).toBe("Duet");
  });

  it("uses a stable default voice", () => {
    expect(extractVoiceIds("X:1\nK:C\nC4|")).toEqual(["default"]);
  });
});

describe("client music helpers", () => {
  it("mutates abcjs note maps with per-voice instruments and mute state", () => {
    const tracks = [
      [{ pitch: 60, instrument: "acoustic_grand_piano", start: 0, end: 1, startChar: 0, endChar: 1, volume: 100 }],
      [{ pitch: 48, instrument: "acoustic_grand_piano", start: 0, end: 1, startChar: 2, endChar: 3, volume: 90 }],
    ];
    applyInstruments(tracks, ["RH", "LH"], { RH: "violin", LH: "cello" }, new Set(["LH"]));
    expect(tracks[0]?.[0]?.instrument).toBe("violin");
    expect(tracks[1]?.[0]).toMatchObject({ instrument: "cello", volume: 0 });
  });

  it("keeps instrument and mute changes independent across voices", () => {
    const tracks = [
      [{ pitch: 60, instrument: "acoustic_grand_piano", start: 0, end: 1, startChar: 0, endChar: 1, volume: 80 }],
      [{ pitch: 48, instrument: "acoustic_grand_piano", start: 0, end: 1, startChar: 2, endChar: 3, volume: 90 }],
    ];
    applyInstruments(tracks, ["RH", "LH"], { RH: "flute", LH: "cello" }, new Set(["RH"]));
    expect(tracks[0]?.[0]).toMatchObject({ instrument: "flute", volume: 0 });
    expect(tracks[1]?.[0]).toMatchObject({ instrument: "cello", volume: 90 });
  });
});
