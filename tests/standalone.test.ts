import { describe, expect, it } from "vitest";
import type { RenderScoreOutput } from "../shared/score";
import { decodeStandaloneScore, encodeStandaloneScore } from "../web/src/standalone";

const output: RenderScoreOutput = {
  schemaVersion: 1,
  voiceIds: ["default"],
  warnings: [],
  score: {
    schemaVersion: 1,
    abc: "X:1\nT:Árbol & cielo\nK:C\nCDEF|",
    playback: { tempo: 96, instruments: {}, mutedVoices: [], loop: false },
    notation: { voiceKinds: {} },
    display: { coloredVoices: true },
  },
};

describe("standalone score links", () => {
  it("round-trips unicode ABC entirely in the URL fragment", () => {
    const hash = encodeStandaloneScore(output);
    expect(hash.startsWith("#score=")).toBe(true);
    expect(decodeStandaloneScore(hash)).toEqual(output);
  });

  it("rejects malformed or schema-invalid fragments", () => {
    expect(decodeStandaloneScore("#score=%7Bbad")).toBeUndefined();
    expect(decodeStandaloneScore("#score=%7B%7D")).toBeUndefined();
    expect(decodeStandaloneScore("#other=value")).toBeUndefined();
  });
});
