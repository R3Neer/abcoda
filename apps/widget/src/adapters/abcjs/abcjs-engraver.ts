import ABCJS from "abcjs";
import type { Engraver, EngravingResult } from "../../application/score-session";
import type {
  ScorePresentationDto,
  ScoreSnapshotDto,
} from "../../../../../packages/contracts/src/index";
import { timelineForTune } from "./abcjs-timeline";
import type { PlaybackTimingCallback } from "../../application/score-cursor";
import { AbcjsPlaybackSource } from "./abcjs-playback-source";
import { pitchesForVoices } from "./abcjs-voice-pitches";

export class AbcjsEngraver implements Engraver {
  constructor(
    private readonly target: HTMLElement,
    private readonly audioTarget: HTMLElement,
    private readonly callbacks: {
      readonly onPlaybackStarted: () => void;
      readonly onPlaybackFinished: () => void;
      readonly onPlaybackEvent: (event: PlaybackTimingCallback) => void;
    },
  ) {}

  async render(
    snapshot: ScoreSnapshotDto,
    presentation: ScorePresentationDto | undefined,
    signal: AbortSignal,
  ): Promise<EngravingResult> {
    signal.throwIfAborted();
    await Promise.resolve();
    signal.throwIfAborted();

    const availableWidth = this.target.clientWidth;
    const tunes = ABCJS.renderAbc(this.target, snapshot.document.source.text, {
      responsive: "resize",
      add_classes: true,
      expandToWidest: true,
      foregroundColor: "currentColor",
      staffwidth: availableWidth > 0 ? Math.max(280, availableWidth - 32) : 720,
      ...(presentation?.preferredMeasuresPerLine === undefined
        ? {}
        : {
            wrap: {
              preferredMeasuresPerLine: presentation.preferredMeasuresPerLine,
              minSpacing: 1.7,
              maxSpacing: 2.8,
            },
          }),
    });
    signal.throwIfAborted();

    if (tunes.length !== 1) {
      this.clear();
      throw new Error("Expected exactly one engraved tune.");
    }

    const bpm = snapshot.document.tempo?.bpm ?? 96;
    const timeline = timelineForTune(tunes[0], bpm);
    const voicePitches = pitchesForVoices(
      tunes[0],
      snapshot.document.voices.map((voice) => voice.id),
      bpm,
    );
    if (!ABCJS.synth.supportsAudio()) return { timeline, voicePitches };
    return {
      timeline,
      voicePitches,
      playbackSource: new AbcjsPlaybackSource(
        this.audioTarget,
        tunes[0],
        bpm,
        this.callbacks,
      ),
    };
  }

  clear(): void {
    this.target.replaceChildren();
  }
}
