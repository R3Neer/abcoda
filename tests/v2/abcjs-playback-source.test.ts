import { describe, expect, it } from "vitest";
import type ABCJS from "abcjs";
import {
  applyVoiceMix,
  tuneWithInstrumentPrograms,
} from "../../apps/widget/src/adapters/abcjs/abcjs-playback-source";
import type {
  VoiceMixSnapshot,
} from "../../apps/widget/src/application/voice-mix";

const mix: VoiceMixSnapshot = {
  revision: 3,
  voices: [
    {
      id: "LEAD",
      kind: "pitched",
      instrument: "violin",
      muted: false,
    },
    {
      id: "DR",
      kind: "unpitched_percussion",
      instrument: "standard_drum_kit",
      muted: true,
    },
  ],
};

describe("abcjs playback source mapping", () => {
  it("injects MIDI programs before abcjs resolves soundfont samples", () => {
    const audio = {
      tracks: [
        [
          {
            cmd: "program",
            instrument: 0,
          },
          {
            cmd: "note",
            instrument: 0,
            pitch: 60,
          },
        ],
        [
          {
            cmd: "program",
            instrument: 0,
          },
          {
            cmd: "note",
            instrument: 0,
            pitch: 38,
          },
        ],
      ],
    } as ABCJS.AudioTracks;

    const tune = {
      setUpAudio: () => audio,
    } as unknown as ABCJS.TuneObject;

    const configured =
      tuneWithInstrumentPrograms(
        tune,
        mix,
      ).setUpAudio({});

    const programs = configured.tracks.map(
      (track) =>
        track.map((event) =>
          "instrument" in event
            ? event.instrument
            : undefined,
        ),
    );

    expect(programs[0]).toEqual([
      40,
      40,
    ]);

    expect(programs[1]).toEqual([
      128,
      128,
    ]);
  });

  it("removes unplayable pitched notes before soundfont sample gathering", () => {
    const contrabassMix: VoiceMixSnapshot = {
      revision: 4,
      voices: [
        {
          id: "BASS",
          kind: "pitched",
          instrument: "contrabass",
          muted: false,
        },
      ],
    };

    const audio = {
      totalDuration: 8,
      tracks: [
        [
          {
            cmd: "program",
            instrument: 0,
          },
          // C4: usual
          {
            cmd: "note",
            instrument: 0,
            pitch: 60,
          },
          // Bb4: extended but playable
          {
            cmd: "note",
            instrument: 0,
            pitch: 70,
          },
          // A5: outside ABCoda playableRange
          {
            cmd: "note",
            instrument: 0,
            pitch: 81,
          },
        ],
      ],
    } as unknown as ABCJS.AudioTracks;

    const tune = {
      setUpAudio: () => audio,
    } as unknown as ABCJS.TuneObject;

    const configured =
      tuneWithInstrumentPrograms(
        tune,
        contrabassMix,
      ).setUpAudio({});

    const notes = configured.tracks[0]
      ?.filter(
        (event) =>
          event.cmd === "note",
      )
      .map((event) => ({
        pitch: event.pitch,
        instrument: event.instrument,
      }));

    expect(notes).toEqual([
      {
        pitch: 60,
        instrument: 43,
      },
      {
        pitch: 70,
        instrument: 43,
      },
    ]);

    expect(
      configured.totalDuration,
    ).toBe(8);
  });

  it("does not apply pitched range filtering to percussion", () => {
    const percussionMix: VoiceMixSnapshot = {
      revision: 5,
      voices: [
        {
          id: "DR",
          kind: "unpitched_percussion",
          instrument: "standard_drum_kit",
          muted: false,
        },
      ],
    };

    const audio = {
      tracks: [
        [
          {
            cmd: "program",
            instrument: 0,
          },
          {
            cmd: "note",
            instrument: 0,
            pitch: 20,
          },
          {
            cmd: "note",
            instrument: 0,
            pitch: 90,
          },
        ],
      ],
    } as ABCJS.AudioTracks;

    const tune = {
      setUpAudio: () => audio,
    } as unknown as ABCJS.TuneObject;

    const configured =
      tuneWithInstrumentPrograms(
        tune,
        percussionMix,
      ).setUpAudio({});

    const pitches =
      configured.tracks[0]
        ?.filter(
          (event) =>
            event.cmd === "note",
        )
        .map(
          (event) => event.pitch,
        );

    expect(pitches).toEqual([
      20,
      90,
    ]);

    expect(
      configured.tracks[0]?.every(
        (event) =>
          !("instrument" in event)
          || event.instrument === 128,
      ),
    ).toBe(true);
  });

  it("maps soundfont ids and mute independently for each voice", () => {
    const sequence = [
      [
        {
          pitch: 60,
          instrument: "acoustic_grand_piano",
          volume: 80,
        },
      ],
      [
        {
          pitch: 38,
          instrument: "acoustic_grand_piano",
          volume: 90,
        },
      ],
    ] as ABCJS.NoteMapTrack[];

    applyVoiceMix(
      sequence,
      mix,
    );

    expect(
      sequence[0]?.[0],
    ).toMatchObject({
      instrument: "violin",
      volume: 80,
    });

    expect(
      sequence[1]?.[0],
    ).toMatchObject({
      instrument: "percussion",
      volume: 0,
    });
  });
});