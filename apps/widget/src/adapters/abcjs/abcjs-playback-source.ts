import ABCJS from "abcjs";
import {
  classifyInstrumentPitch,
  instrumentDefinition,
} from "../../../../../packages/domain/src/index";
import type {
  VoiceMixPlaybackSource,
  VoiceMixSnapshot,
} from "../../application/voice-mix";
import type { PlaybackTimingCallback } from "../../application/score-cursor";
import { AbcjsPlaybackEngine, type AbcjsSynthController } from "./abcjs-playback-engine";
import { callbackTiming } from "./abcjs-timeline";

const hiddenSynthOptions: ABCJS.SynthVisualOptions = {
  displayLoop: false,
  displayPlay: false,
  displayProgress: false,
  displayRestart: false,
  displayWarp: true,
};

export interface PlaybackSourceCallbacks {
  readonly onPlaybackStarted: () => void;
  readonly onPlaybackFinished: () => void;
  readonly onPlaybackEvent: (event: PlaybackTimingCallback) => void;
}

export class AbcjsPlaybackSource implements VoiceMixPlaybackSource {
  constructor(
    private readonly audioTarget: HTMLElement,
    private readonly tune: ABCJS.TuneObject,
    private readonly bpm: number,
    private readonly callbacks: PlaybackSourceCallbacks,
  ) {}

  async create(mix: VoiceMixSnapshot): Promise<AbcjsPlaybackEngine> {
    const synth = new ABCJS.synth.SynthController();
    let callbacksEnabled = true;

    synth.load(this.audioTarget, {
      onStart: () => {
        if (callbacksEnabled) {
          this.callbacks.onPlaybackStarted();
        }
      },
      onFinished: () => {
        if (callbacksEnabled) {
          this.callbacks.onPlaybackFinished();
        }
      },
      onEvent: (event) => {
        if (callbacksEnabled) {
          this.callbacks.onPlaybackEvent(
            callbackTiming(event),
          );
        }
      },
    }, hiddenSynthOptions);

    const playback = new AbcjsPlaybackEngine(
      synth as unknown as AbcjsSynthController,
      tuneWithInstrumentPrograms(this.tune, mix),
      {
        qpm: this.bpm,
        chordsOff: true,
        soundFontVolumeMultiplier: 3,
        sequenceCallback: (sequence) => applyVoiceMix(sequence, mix),
      },
      async () => {
        const context = ABCJS.synth.activeAudioContext();

        if (context.state !== "running") {
          await context.resume();
        }

        if (context.state !== "running") {
          throw new Error(
            "Audio is blocked by the browser. Press Play again after enabling sound.",
          );
        }
      },
      () => {
        callbacksEnabled = false;
      },
    );

    try {
      await playback.initialize();
      return playback;
    } catch (error) {
      callbacksEnabled = false;
      throw error;
    }
  }
}

export function tuneWithInstrumentPrograms(
  tune: ABCJS.TuneObject,
  mix: VoiceMixSnapshot,
): ABCJS.TuneObject {
  const playbackTune = Object.create(tune) as ABCJS.TuneObject;
  playbackTune.setUpAudio = (options) => {
    const sourceAudio = tune.setUpAudio(options);
    const audio: ABCJS.AudioTracks = {
      ...sourceAudio,
      tracks: sourceAudio.tracks.map((track) => (
        track.map((event) => ({ ...event }))
      )),
    };

    audio.tracks.forEach((track, index) => {
      const assignment = mix.voices[index] ?? mix.voices[0];
      if (!assignment) return;
      const definition = instrumentDefinition(assignment.instrument);
      const program = definition.voiceKind === "unpitched_percussion"
        ? 128
        : definition.midiProgram;

      track.forEach((event) => {
        if (
          event.cmd === "note"
          && definition.voiceKind === "pitched"
          && classifyInstrumentPitch(event.pitch, assignment.instrument) === "unplayable"
        ) {
          // CreateSynth gathers samples from event.pitch before sequenceCallback.
          // Keep this event in place for timing/cursor callbacks, but make it
          // silent and point its hidden sample request at a normal-range pitch.
          event.pitch = event.pitch < definition.playableRange.min
            ? definition.usualRange.min
            : definition.usualRange.max;
          event.volume = 0;
        }

        if (
          (event.cmd === "program" || event.cmd === "note")
          && program !== undefined
        ) {
          event.instrument = program;
        }
      });
    });
    return audio;
  };
  return playbackTune;
}

export function applyVoiceMix(
  sequence: ABCJS.NoteMapTrack[],
  mix: VoiceMixSnapshot,
): ABCJS.NoteMapTrack[] {
  sequence.forEach((track, index) => {
    const assignment = mix.voices[index] ?? mix.voices[0];
    if (!assignment) return;
    track.forEach((event) => {
      event.instrument = assignment.instrument === "standard_drum_kit"
        ? "percussion"
        : assignment.instrument;
      if (assignment.muted) event.volume = 0;
    });
  });
  return sequence;
}
