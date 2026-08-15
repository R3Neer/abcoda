import ABCJS from "abcjs";
import type { Engraver, EngravingResult } from "../../application/score-session";
import { AbcjsPlaybackEngine } from "./abcjs-playback-engine";
import type { AbcjsSynthController } from "./abcjs-playback-engine";

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
    private readonly onPlaybackFinished: () => void,
  ) {}

  async render(abc: string, signal: AbortSignal): Promise<EngravingResult> {
    signal.throwIfAborted();
    await Promise.resolve();
    signal.throwIfAborted();

    const availableWidth = this.target.clientWidth;
    const tunes = ABCJS.renderAbc(this.target, abc, {
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

    if (!ABCJS.synth.supportsAudio()) return {};
    const synth = new ABCJS.synth.SynthController();
    synth.load(this.audioTarget, {
      onFinished: this.onPlaybackFinished,
    }, hiddenSynthOptions);
    const playback = new AbcjsPlaybackEngine(
      synth as unknown as AbcjsSynthController,
      tunes[0],
      { qpm: 96, chordsOff: true, soundFontVolumeMultiplier: 3 },
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
    return { playback };
  }

  clear(): void {
    this.target.replaceChildren();
  }
}
