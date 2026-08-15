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
  it("injects MIDI programs before abcjs resolves soundfont samples", () => {
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
});
