import type ABCJS from "abcjs";
import type { PlaybackBackend } from "./transport";

export interface SynthControllerLike {
  setTune(
    tune: ABCJS.TuneObject,
    userAction: boolean,
    options: ABCJS.SynthOptions,
  ): Promise<ABCJS.SynthInitResponse>;
  play(): Promise<unknown> | void;
  pause(): void;
  restart(): void;
  setProgress(percent: number): void;
  toggleLoop(): void;
  setWarp(percent: number): Promise<void> | void;
  percent?: number;
}

export type EnsureAudioContext = () => Promise<void>;

export class DeferredAudioBackend implements PlaybackBackend {
  private tune: ABCJS.TuneObject | undefined;
  private options: ABCJS.SynthOptions | undefined;
  private prepared = false;
  private loop = false;
  private warp = 100;
  private progress = 0;

  constructor(
    private readonly synth: SynthControllerLike,
    private readonly ensureAudioContext: EnsureAudioContext = async () => undefined,
  ) {}

  async configure(tune: ABCJS.TuneObject, options: ABCJS.SynthOptions): Promise<void> {
    this.tune = tune;
    this.options = options;
    this.prepared = false;
    this.progress = 0;
    await this.synth.setTune(tune, false, options);
  }

  async play(): Promise<void> {
    if (!this.tune || !this.options) return;
    // Create/resume Web Audio synchronously from the Play gesture. In an
    // embedded host, waiting until after samples have loaded can lose the
    // browser's transient user activation and leave a running, silent timer.
    await this.ensureAudioContext();
    if (!this.prepared) {
      const response = await this.synth.setTune(this.tune, true, this.options);
      if (response.status !== "created") {
        throw new Error("The browser did not create an audio context.");
      }
      this.prepared = true;
      if (this.loop) this.synth.toggleLoop();
      if (this.warp !== 100) await this.synth.setWarp(this.warp);
      if (this.progress > 0) this.synth.setProgress(this.progress);
    }
    await this.synth.play();
    await this.ensureAudioContext();
  }

  async pause(): Promise<void> {
    if (this.prepared) await this.synth.play();
  }

  restart(): void {
    this.progress = 0;
    if (this.prepared) this.synth.restart();
  }

  getProgress(): number {
    const current = this.synth.percent;
    return typeof current === "number" && Number.isFinite(current)
      ? Math.max(0, Math.min(1, current))
      : this.progress;
  }

  setProgress(percent: number): void {
    this.progress = percent;
    if (this.prepared) this.synth.setProgress(percent);
  }

  toggleLoop(): void {
    this.loop = !this.loop;
    if (this.prepared) this.synth.toggleLoop();
  }

  async setWarp(percent: number): Promise<void> {
    this.warp = percent;
    if (this.prepared) await this.synth.setWarp(percent);
  }
}
