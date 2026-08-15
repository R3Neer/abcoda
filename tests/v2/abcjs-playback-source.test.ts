import { describe, expect, it } from "vitest";
import type ABCJS from "abcjs";
import {
  applyVoiceMix,
  tuneWithInstrumentPrograms,
} from "../../apps/widget/src/adapters/abcjs/abcjs-playback-source";
import type { VoiceMixSnapshot } from "../../apps/widget/src/application/voice-mix";

const mix: VoiceMixSnapshot = {
  revision: 3,
  voices: [
    { id: "LEAD", kind: "pitched", instrument: "violin", muted: false },
    { id: "DR", kind: "unpitched_percussion", instrument: "standard_drum_kit", muted: true },
  ],
};

describe("abcjs playback source mapping", () => {
  it("injects MIDI programs before abcjs resolves soundfont samples without mutating the source tracks", () => {
    const audio = {
      tracks: [
        [{ cmd: "program", instrument: 0 }, { cmd: "note", instrument: 0, pitch: 60 }],
        [{ cmd: "program", instrument: 0 }, { cmd: "note", instrument: 0, pitch: 38 }],
      ],
    } as ABCJS.AudioTracks;
    const tune = {
      setUpAudio: () => audio,
    } as unknown as ABCJS.TuneObject;

    const configured = tuneWithInstrumentPrograms(tune, mix).setUpAudio({});

    const programs = configured.tracks.map((track) => track.map((event) =>
      "instrument" in event ? event.instrument : undefined,
    ));
    expect(programs[0]).toEqual([40, 40]);
    expect(programs[1]).toEqual([128, 128]);
    expect(audio.tracks[0]?.map((event) => "instrument" in event ? event.instrument : undefined)).toEqual([0, 0]);
    expect(audio.tracks[1]?.map((event) => "instrument" in event ? event.instrument : undefined)).toEqual([0, 0]);
  });

  it("maps soundfont ids and mute independently for each voice", () => {
    const sequence = [
      [{ pitch: 60, instrument: "acoustic_grand_piano", volume: 80 }],
      [{ pitch: 38, instrument: "acoustic_grand_piano", volume: 90 }],
    ] as ABCJS.NoteMapTrack[];

    applyVoiceMix(sequence, mix);

    expect(sequence[0]?.[0]).toMatchObject({ instrument: "violin", volume: 80 });
    expect(sequence[1]?.[0]).toMatchObject({ instrument: "percussion", volume: 0 });
  });

  it("keeps musically unplayable events in the timeline while using a backend-safe hidden sample", () => {
    const trumpetMix: VoiceMixSnapshot = {
      revision: 4,
      voices: [
        { id: "TR", kind: "pitched", instrument: "trumpet", muted: false },
      ],
    };
    const audio = {
      tracks: [[
        { cmd: "program", instrument: 0 },
        {
          cmd: "note",
          instrument: 0,
          pitch: 84,
          volume: 80,
          start: 0,
          duration: 0.25,
          gap: 0,
          startChar: 10,
          endChar: 11,
        },
        {
          cmd: "note",
          instrument: 0,
          pitch: 89,
          volume: 80,
          start: 0.25,
          duration: 0.25,
          gap: 0,
          startChar: 12,
          endChar: 13,
        },
        {
          cmd: "note",
          instrument: 0,
          pitch: 90,
          volume: 80,
          start: 0.5,
          duration: 0.25,
          gap: 0,
          startChar: 14,
          endChar: 15,
        },
      ]],
    } as ABCJS.AudioTracks;
    const tune = {
      setUpAudio: () => audio,
    } as unknown as ABCJS.TuneObject;

    const configured = tuneWithInstrumentPrograms(tune, trumpetMix).setUpAudio({});
    const notes = configured.tracks[0]?.filter(
      (event): event is ABCJS.AudioTrackNoteItem => event.cmd === "note",
    ) ?? [];
    const sourceNotes = audio.tracks[0]?.filter(
      (event): event is ABCJS.AudioTrackNoteItem => event.cmd === "note",
    ) ?? [];

    expect(notes).toHaveLength(3);
    expect(notes.map((event) => event.pitch)).toEqual([84, 89, 60]);
    expect(notes.map((event) => event.volume)).toEqual([80, 80, 0]);
    expect(notes.map((event) => event.instrument)).toEqual([56, 56, 56]);
    expect(notes[2]).toMatchObject({
      start: 0.5,
      duration: 0.25,
      startChar: 14,
      endChar: 15,
    });
    expect(sourceNotes.map((event) => event.pitch)).toEqual([84, 89, 90]);
    expect(sourceNotes.map((event) => event.volume)).toEqual([80, 80, 80]);
    expect(sourceNotes.map((event) => event.instrument)).toEqual([0, 0, 0]);
  });

  it("keeps playable contrabass notes audible when the same phrase also contains unplayable notes", () => {
    const contrabassMix: VoiceMixSnapshot = {
      revision: 5,
      voices: [
        { id: "CB", kind: "pitched", instrument: "contrabass", muted: false },
      ],
    };
    const sourcePitches = [60, 62, 64, 65, 67, 69, 71, 72];
    const audio = {
      tracks: [[
        { cmd: "program", instrument: 0 },
        ...sourcePitches.map((pitch, index) => ({
          cmd: "note" as const,
          instrument: 0,
          pitch,
          volume: 80,
          start: index * 0.125,
          duration: 0.125,
          gap: 0,
          startChar: 20 + index * 2,
          endChar: 21 + index * 2,
        })),
      ]],
    } as ABCJS.AudioTracks;
    const tune = {
      setUpAudio: () => audio,
    } as unknown as ABCJS.TuneObject;

    const configured = tuneWithInstrumentPrograms(tune, contrabassMix).setUpAudio({});
    const notes = configured.tracks[0]?.filter(
      (event): event is ABCJS.AudioTrackNoteItem => event.cmd === "note",
    ) ?? [];
    const originalNotes = audio.tracks[0]?.filter(
      (event): event is ABCJS.AudioTrackNoteItem => event.cmd === "note",
    ) ?? [];

    expect(notes).toHaveLength(8);
    expect(notes.map((event) => event.volume)).toEqual([
      80, 80, 80, 80, 80, 0, 0, 0,
    ]);
    expect(notes.map((event) => event.pitch)).toEqual([
      60, 62, 64, 65, 67, 60, 60, 60,
    ]);
    expect(notes.map((event) => event.instrument)).toEqual([
      43, 43, 43, 43, 43, 43, 43, 43,
    ]);
    expect(originalNotes.map((event) => event.pitch)).toEqual(sourcePitches);
    expect(originalNotes.map((event) => event.volume)).toEqual([
      80, 80, 80, 80, 80, 80, 80, 80,
    ]);
  });

  it("keeps supported unbounded pitches musical while neutralizing samples beyond the backend", () => {
    const choirMix: VoiceMixSnapshot = {
      revision: 6,
      voices: [
        { id: "CH", kind: "pitched", instrument: "choir_aahs", muted: false },
      ],
    };
    const audio = {
      tracks: [[
        { cmd: "program", instrument: 0 },
        {
          cmd: "note",
          instrument: 0,
          pitch: 108,
          volume: 80,
          start: 0,
          duration: 0.5,
        },
        {
          cmd: "note",
          instrument: 0,
          pitch: 109,
          volume: 80,
          start: 0.5,
          duration: 0.5,
        },
      ]],
    } as ABCJS.AudioTracks;
    const tune = {
      setUpAudio: () => audio,
    } as unknown as ABCJS.TuneObject;

    const configured = tuneWithInstrumentPrograms(tune, choirMix).setUpAudio({});
    const notes = configured.tracks[0]?.filter(
      (event): event is ABCJS.AudioTrackNoteItem => event.cmd === "note",
    ) ?? [];
    const sourceNotes = audio.tracks[0]?.filter(
      (event): event is ABCJS.AudioTrackNoteItem => event.cmd === "note",
    ) ?? [];

    expect(notes).toHaveLength(2);
    expect(notes.map((event) => event.pitch)).toEqual([108, 60]);
    expect(notes.map((event) => event.volume)).toEqual([80, 0]);
    expect(notes.map((event) => event.instrument)).toEqual([52, 52]);
    expect(notes[1]).toMatchObject({ start: 0.5, duration: 0.5 });
    expect(sourceNotes.map((event) => event.pitch)).toEqual([108, 109]);
    expect(sourceNotes.map((event) => event.volume)).toEqual([80, 80]);
  });

  it("neutralizes percussion pitches beyond the characterized sample folder without deleting events", () => {
    const percussionMix: VoiceMixSnapshot = {
      revision: 7,
      voices: [
        { id: "DR", kind: "unpitched_percussion", instrument: "standard_drum_kit", muted: false },
      ],
    };
    const audio = {
      tracks: [[
        { cmd: "program", instrument: 0 },
        { cmd: "note", instrument: 0, pitch: 87, volume: 80, start: 0, duration: 0.25 },
        { cmd: "note", instrument: 0, pitch: 88, volume: 80, start: 0.25, duration: 0.25 },
      ]],
    } as ABCJS.AudioTracks;
    const tune = {
      setUpAudio: () => audio,
    } as unknown as ABCJS.TuneObject;

    const configured = tuneWithInstrumentPrograms(tune, percussionMix).setUpAudio({});
    const notes = configured.tracks[0]?.filter(
      (event): event is ABCJS.AudioTrackNoteItem => event.cmd === "note",
    ) ?? [];
    const sourceNotes = audio.tracks[0]?.filter(
      (event): event is ABCJS.AudioTrackNoteItem => event.cmd === "note",
    ) ?? [];

    expect(notes).toHaveLength(2);
    expect(notes.map((event) => event.pitch)).toEqual([87, 36]);
    expect(notes.map((event) => event.volume)).toEqual([80, 0]);
    expect(notes.map((event) => event.instrument)).toEqual([128, 128]);
    expect(notes[1]).toMatchObject({ start: 0.25, duration: 0.25 });
    expect(sourceNotes.map((event) => event.pitch)).toEqual([87, 88]);
    expect(sourceNotes.map((event) => event.volume)).toEqual([80, 80]);
  });
});
