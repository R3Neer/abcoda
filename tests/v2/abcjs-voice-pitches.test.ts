import { describe, expect, it } from "vitest";
import type ABCJS from "abcjs";
import {
  analyzeVoicePitches,
  pitchesForVoices,
} from "../../apps/widget/src/adapters/abcjs/abcjs-voice-pitches";

describe("pitchesForVoices", () => {
  it("maps unique sounding pitches by canonical voice order", () => {
    const tune = {
      setUpAudio: () => ({
        tracks: [
          [{ cmd: "note", pitch: 60 }, { cmd: "note", pitch: 60 }, { cmd: "note", pitch: 64 }],
          [{ cmd: "note", pitch: 48 }],
        ],
      }),
    } as unknown as ABCJS.TuneObject;

    expect(pitchesForVoices(tune, ["RH", "LH"], 84)).toEqual({
      RH: [60, 64],
      LH: [48],
    });
  });

  it("links sounding pitches to engraved selectables by voice class and source offset", () => {
    const firstSvg = {
      getAttribute: (name: string) => name === "class" ? "abcjs-note abcjs-v0" : null,
    } as unknown as SVGElement;
    const secondSvg = {
      getAttribute: (name: string) => name === "class" ? "abcjs-note abcjs-v0" : null,
    } as unknown as SVGElement;
    const tune = {
      setUpAudio: () => ({
        tracks: [[
          { cmd: "note", pitch: 84, startChar: 20 },
          { cmd: "note", pitch: 88, startChar: 24 },
        ]],
      }),
      engraver: {
        selectables: [
          {
            svgEl: firstSvg,
            absEl: { abcelem: { el_type: "note", startChar: 20 } },
          },
          {
            svgEl: secondSvg,
            absEl: { abcelem: { el_type: "note", startChar: 24 } },
          },
        ],
      },
    } as unknown as ABCJS.TuneObject;

    const analysis = analyzeVoicePitches(tune, ["TR"], 96);

    expect(analysis.pitchesByVoice).toEqual({ TR: [84, 88] });
    expect(analysis.targetsByVoice.TR).toEqual([
      { element: firstSvg, pitches: [84] },
      { element: secondSvg, pitches: [88] },
    ]);
  });
});
