import type ABCJS from "abcjs";
import type { PlaybackEngine } from "../../application/playback-session";

export interface AbcjsSynthController {
  setTune(
    tune: ABCJS.TuneObject,
    userAction: boolean,
    options: ABCJS.SynthOptions,
  ): Promise<ABCJS.SynthInitResponse>;
  play(): Promise<unknown> | void;
  pause(): void;
  restart(): void;
  seek(progress: number, units: "percent"): void;
  setProgress(progress: number): void;
  toggleLoop(): void;
  setWarp(percent: number): Promise<void> | void;
  percent?: number;
}

export class AbcjsPlaybackEngine implements PlaybackEngine {
  private prepared = false;
  private loop = false;
  private tempoRatio = 1;
  private storedProgress = 0;

  constructor(
    private readonly synth: AbcjsSynthController,
    private readonly tune: ABCJS.TuneObject,
    private readonly options: ABCJS.SynthOptions,
    private readonly ensureAudioContext: () => Promise<void>,
  ) {}

  async initialize(): Promise<void> {
    await this.synth.setTune(this.tune, false, this.options);
  }

  async play(): Promise<void> {
    await this.ensureAudioContext();
    if (!this.prepared) {
      const response = await this.synth.setTune(this.tune, true, this.options);
      if (response.status !== "created") {
        throw new Error("The browser did not create an audio context.");
      }
      this.prepared = true;
      if (this.loop) this.synth.toggleLoop();
      if (this.tempoRatio !== 1) await this.synth.setWarp(this.tempoRatio * 100);
      if (this.storedProgress > 0) this.applyProgress();
    }
    await this.synth.play();
    await this.ensureAudioContext();
  }

  pause(): Promise<void> {
    if (this.prepared) this.synth.pause();
    return Promise.resolve();
  }

  restart(): void {
    this.storedProgress = 0;
    if (this.prepared) this.synth.restart();
  }

  progress(): number {
    const current = this.synth.percent;
    return typeof current === "number" && Number.isFinite(current)
      ? clampProgress(current)
      : this.storedProgress;
  }

  seek(progress: number): void {
    this.storedProgress = clampProgress(progress);
    if (this.prepared) this.applyProgress();
  }

  setLoop(enabled: boolean): void {
    if (enabled === this.loop) return;
    this.loop = enabled;
    if (this.prepared) this.synth.toggleLoop();
  }

  async setTempoRatio(ratio: number): Promise<void> {
    if (!Number.isFinite(ratio) || ratio <= 0) throw new Error("Tempo ratio must be positive.");
    this.tempoRatio = ratio;
    if (this.prepared) await this.synth.setWarp(ratio * 100);
  }

  async dispose(): Promise<void> {
    if (this.prepared) this.synth.pause();
    this.prepared = false;
    await Promise.resolve();
  }

  private applyProgress(): void {
    this.synth.setProgress(this.storedProgress);
    this.synth.seek(this.storedProgress, "percent");
  }
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
}
