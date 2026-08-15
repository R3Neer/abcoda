import ABCJS from "abcjs";
import type { Engraver, EngravingResult } from "../../application/score-session";
import type { ScoreSnapshotDto } from "../../../../../packages/contracts/src/index";
import { AbcjsPlaybackEngine } from "./abcjs-playback-engine";
import type { AbcjsSynthController } from "./abcjs-playback-engine";
import { callbackTiming, timelineForTune } from "./abcjs-timeline";
import type { PlaybackTimingCallback } from "../../application/score-cursor";

const hiddenSynthOptions: ABCJS.SynthVisualOptions = {
  displayLoop: false,
  displayPlay: false,
  displayProgress: false,
  displayRestart: false,
  displayWarp: true,
};

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

  async render(snapshot: ScoreSnapshotDto, signal: AbortSignal): Promise<EngravingResult> {
    signal.throwIfAborted();
    await Promise.resolve();
    signal.throwIfAborted();

    const availableWidth = this.target.clientWidth;
    const tunes = ABCJS.renderAbc(this.target, snapshot.document.source.text, {
      responsive: "resize",
      add_classes: true,
      expandToWidest: true,
      staffwidth: availableWidth > 0 ? Math.max(280, availableWidth - 32) : 720,
    });
    signal.throwIfAborted();

    if (tunes.length !== 1) {
      this.clear();
      throw new Error("Expected exactly one engraved tune.");
    }

    const bpm = snapshot.document.tempo?.bpm ?? 96;
    const timeline = timelineForTune(tunes[0], bpm);
    if (!ABCJS.synth.supportsAudio()) return { timeline };
    const synth = new ABCJS.synth.SynthController();
    synth.load(this.audioTarget, {
      onStart: this.callbacks.onPlaybackStarted,
      onFinished: this.callbacks.onPlaybackFinished,
      onEvent: (event) => this.callbacks.onPlaybackEvent(callbackTiming(event)),
    }, hiddenSynthOptions);
    const playback = new AbcjsPlaybackEngine(
      synth as unknown as AbcjsSynthController,
      tunes[0],
      {
        qpm: bpm,
        chordsOff: true,
        soundFontVolumeMultiplier: 3,
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
    signal.throwIfAborted();
    return { playback, timeline };
  }

  clear(): void {
    this.target.replaceChildren();
  }
}
