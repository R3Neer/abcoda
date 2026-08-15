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

  it("links sounding pitches to the engraved selectable with the same source offset", () => {
    const firstSvg = {} as SVGElement;
    const secondSvg = {} as SVGElement;
    const tune = {
      setUpAudio: () => ({
        tracks: [[
          { cmd: "note", pitch: 84, startChar: 20 },
          { cmd: "note", pitch: 88, startChar: 24 },
        ]],
      }),
      makeVoicesArray: () => [[
        {
          svgEl: firstSvg,
          absEl: { abcelem: { el_type: "note", startChar: 20 } },
        },
        {
          svgEl: secondSvg,
          absEl: { abcelem: { el_type: "note", startChar: 24 } },
        },
      ]],
    } as unknown as ABCJS.TuneObject;

    const analysis = analyzeVoicePitches(tune, ["TR"], 96);

    expect(analysis.pitchesByVoice).toEqual({ TR: [84, 88] });
    expect(analysis.targetsByVoice.TR).toEqual([
      { element: firstSvg, pitches: [84] },
      { element: secondSvg, pitches: [88] },
    ]);
  });
});
