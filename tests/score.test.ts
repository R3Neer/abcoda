import ABCJS from "abcjs";
import { describe, expect, it } from "vitest";
import { instrumentNames, renderScoreInputSchema } from "../shared/score";
import { abcTitle, extractVoiceIds, scoreVoiceOrder } from "../shared/voices";
import {
  applyInstrumentPrograms,
  applyInstruments,
  instrumentForVoiceKind,
  instrumentFromLabel,
  instrumentLabel,
  pitchesByVoice,
  playbackTuneForInstruments,
  rangeFit,
  voiceKindForInstrument,
} from "../web/src/music";

const mixed = `X:1
T:Mixed
M:4/4
L:1/4
V:P clef=treble
V:D clef=bass
K:C
%%score { P D }
[V:P] C D E F|]
[V:D] C D E F|]`;

describe("score contract", () => {
  it("fills lightweight playback defaults", () => {
    const parsed = renderScoreInputSchema.parse({ abc: "X:1\nK:C\nCDEF|" });
    expect(parsed.playback.tempo).toBe(96);
    expect(parsed.playback.instruments).toEqual({});
    expect(parsed.notation.voiceKinds).toEqual({});
    expect(parsed.display.coloredVoices).toBe(false);
    expect(parsed.schemaVersion).toBe(1);
  });

  it("keeps the legacy voice-color field parseable but defaults to one host-theme color", () => {
    expect(renderScoreInputSchema.parse({ abc: "X:1\nK:C\nCDEF|", display: { coloredVoices: true } }).display.coloredVoices).toBe(true);
    expect(renderScoreInputSchema.parse({ abc: "X:1\nK:C\nCDEF|" }).display.coloredVoices).toBe(false);
  });

  it("rejects unsafe score sizes and impossible tempi", () => {
    expect(() => renderScoreInputSchema.parse({ abc: "X:1\nK:C\nC|", playback: { tempo: 500 } })).toThrow();
    expect(() => renderScoreInputSchema.parse({ abc: "" })).toThrow();
  });

  it("accepts the abcjs percussion soundfont as an explicit instrument", () => {
    const parsed = renderScoreInputSchema.parse({
      abc: "X:1\nK:none\nCDEF|",
      playback: { instruments: { DR: "percussion" } },
    });
    expect(parsed.playback.instruments.DR).toBe("percussion");
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

  it("uses %%score order for playback track mapping", () => {
    expect(scoreVoiceOrder("X:1\n%%score { B A }\nV:A\nV:B\nK:C\n[V:A] C4|]\n[V:B] E4|]")).toEqual(["B", "A"]);
  });
});

describe("client music helpers", () => {
  it("couples every playback instrument to a safe notation kind", () => {
    expect(instrumentNames.map(voiceKindForInstrument)).toEqual([
      ...Array(instrumentNames.length - 1).fill("pitched"),
      "unpitched_percussion",
    ]);
    expect(voiceKindForInstrument("percussion")).toBe("unpitched_percussion");
    expect(voiceKindForInstrument("cello")).toBe("pitched");
    expect(instrumentForVoiceKind("unpitched_percussion", "violin")).toBe("percussion");
    expect(instrumentForVoiceKind("pitched", "percussion")).toBe("acoustic_grand_piano");
    expect(instrumentForVoiceKind("pitched", "flute")).toBe("flute");
  });

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

  it("sets MIDI programs before abcjs gathers SoundFont samples", () => {
    const audio = {
      tracks: [
        [{ cmd: "program", instrument: 0 }, { cmd: "note", instrument: 0, pitch: 60 }],
        [{ cmd: "program", instrument: 0 }, { cmd: "note", instrument: 0, pitch: 48 }],
      ],
      totalDuration: 1,
    } as ABCJS.AudioTracks;
    applyInstrumentPrograms(audio, ["RH", "LH"], { RH: "violin", LH: "cello" });
    expect(audio.tracks[0]?.filter((event) => event.cmd !== "text").map((event) => event.instrument)).toEqual([40, 40]);
    expect(audio.tracks[1]?.filter((event) => event.cmd !== "text").map((event) => event.instrument)).toEqual([42, 42]);
  });

  it("wraps the tune so selected instruments are present during audio setup", () => {
    const tune = ABCJS.parseOnly(mixed)[0]!;
    const playbackTune = playbackTuneForInstruments(tune, ["P", "D"], { P: "violin", D: "cello" });
    const tracks = playbackTune.setUpAudio({ qpm: 96 }).tracks;
    expect(tracks[0]?.find((event) => event.cmd === "note")?.instrument).toBe(40);
    expect(tracks[1]?.find((event) => event.cmd === "note")?.instrument).toBe(42);
  });

  it("reports full, partial, and completely missing instrument ranges", () => {
    expect(rangeFit([60, 72], "violin").fit).toBe("inside");
    expect(rangeFit([54, 60, 106], "violin")).toMatchObject({ fit: "partial", inside: 1, outside: 2 });
    expect(rangeFit([20, 30], "violin").fit).toBe("outside");
    expect(rangeFit([], "violin").fit).toBe("empty");
  });

  it("uses searchable human labels while accepting canonical instrument names", () => {
    expect(instrumentLabel("acoustic_grand_piano")).toBe("acoustic grand piano");
    expect(instrumentLabel("percussion")).toBe("Standard drum kit");
    expect(instrumentFromLabel("Acoustic Grand Piano")).toBe("acoustic_grand_piano");
    expect(instrumentFromLabel("clarinet")).toBe("clarinet");
    expect(instrumentFromLabel("not an instrument")).toBeUndefined();
  });

  it("extracts the sounding pitches of each abcjs voice for range checks", () => {
    const tune = ABCJS.parseOnly(mixed)[0]!;
    const pitches = pitchesByVoice(tune, ["P", "D"], 96);
    expect(pitches.P).toEqual(expect.arrayContaining([60, 62, 64, 65]));
    expect(pitches.D).toEqual(expect.arrayContaining([60, 62, 64, 65]));
  });
});
