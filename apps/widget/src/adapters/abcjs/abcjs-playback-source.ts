import ABCJS from "abcjs";
import { instrumentDefinition } from "../../../../../packages/domain/src/index";
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
    synth.load(this.audioTarget, {
      onStart: this.callbacks.onPlaybackStarted,
      onFinished: this.callbacks.onPlaybackFinished,
      onEvent: (event) => this.callbacks.onPlaybackEvent(callbackTiming(event)),
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
        if (context.state !== "running") await context.resume();
        if (context.state !== "running") {
          throw new Error("Audio is blocked by the browser. Press Play again after enabling sound.");
        }
      },
    );
    await playback.initialize();
    return playback;
  }
}

export function tuneWithInstrumentPrograms(
  tune: ABCJS.TuneObject,
  mix: VoiceMixSnapshot,
): ABCJS.TuneObject {
  const playbackTune = Object.create(tune) as ABCJS.TuneObject;
  playbackTune.setUpAudio = (options) => {
    const audio = tune.setUpAudio(options);
    audio.tracks.forEach((track, index) => {
      const assignment = mix.voices[index] ?? mix.voices[0];
      if (!assignment) return;
      const definition = instrumentDefinition(assignment.instrument);
      const program = definition.voiceKind === "unpitched_percussion"
        ? 128
        : definition.midiProgram;
      track.forEach((event) => {
        if ((event.cmd === "program" || event.cmd === "note") && program !== undefined) {
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
