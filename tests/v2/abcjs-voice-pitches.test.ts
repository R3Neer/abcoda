import { describe, expect, it } from "vitest";
import type ABCJS from "abcjs";
import { pitchesForVoices } from "../../apps/widget/src/adapters/abcjs/abcjs-voice-pitches";

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
});
