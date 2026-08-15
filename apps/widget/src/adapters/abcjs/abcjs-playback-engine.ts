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
  readonly isStarted?: boolean;
}

export class AbcjsPlaybackEngine implements PlaybackEngine {
  private prepared = false;
  private loop = false;
  private tempoRatio = 1;
  private storedProgress = 0;
  private tempoChanging = false;
  private disposed = false;

  constructor(
    private readonly synth: AbcjsSynthController,
    private readonly tune: ABCJS.TuneObject,
    private readonly options: ABCJS.SynthOptions,
    private readonly ensureAudioContext: () => Promise<void>,
    private readonly onDispose: () => void = () => undefined,
  ) {}

  async initialize(): Promise<void> {
    if (this.disposed) return;

    await this.synth.setTune(this.tune, false, this.options);

    if (this.disposed) {
      this.synth.pause();
    }
  }

  async play(): Promise<void> {
    if (this.disposed) return;

    await this.ensureAudioContext();
    if (this.disposed) return;

    if (!this.prepared) {
      const response = await this.synth.setTune(
        this.tune,
        true,
        this.options,
      );

      if (this.disposed) {
        this.synth.pause();
        return;
      }

      if (response.status !== "created") {
        throw new Error(
          "The browser did not create an audio context.",
        );
      }

      this.prepared = true;

      if (this.loop) {
        this.synth.toggleLoop();
      }

      if (this.tempoRatio !== 1) {
        await this.synth.setWarp(
          this.tempoRatio * 100,
        );

        if (this.disposed) {
          this.synth.pause();
          return;
        }
      }

      if (this.storedProgress > 0) {
        this.applyProgress();
      }
    }

    // ABCoda exposes explicit play semantics even though abcjs
    // exposes a toggle. Do not accidentally toggle a running
    // synth back into pause.
    if (this.synth.isStarted === true) {
      return;
    }

    await this.synth.play();

    if (this.disposed) {
      this.synth.pause();
      return;
    }

    await this.ensureAudioContext();

    if (this.disposed) {
      this.synth.pause();
    }
  }

  async pause(): Promise<void> {
    if (this.disposed || !this.prepared) {
      return;
    }

    // abcjs.pause() stops the timer/audio but leaves isStarted
    // untouched. The only public operation that also clears
    // abcjs's toggle state is play(), which toggles true -> false
    // and internally calls pause().
    //
    // Therefore the adapter must use the toggle to implement the
    // explicit PlaybackEngine.pause() contract.
    if (this.synth.isStarted === false) {
      return;
    }

    await this.synth.play();

    if (this.disposed) {
      this.synth.pause();
    }
  }

  restart(): void {
    if (this.disposed) return;

    this.storedProgress = 0;

    if (this.prepared) {
      this.synth.restart();
    }
  }

  progress(): number {
    // abcjs temporarily resets its own percent while rebuilding
    // audio for setWarp(). During that window the logical playback
    // position is the position captured by ABCoda.
    if (this.tempoChanging) {
      return this.storedProgress;
    }

    const current = this.synth.percent;

    return typeof current === "number" && Number.isFinite(current)
      ? clampProgress(current)
      : this.storedProgress;
  }

  seek(progress: number): void {
    if (this.disposed) return;

    this.storedProgress = clampProgress(progress);

    if (this.prepared) {
      this.applyProgress();
    }
  }

  setLoop(enabled: boolean): void {
    if (this.disposed || enabled === this.loop) {
      return;
    }

    this.loop = enabled;

    if (this.prepared) {
      this.synth.toggleLoop();
    }
  }

  async setTempoRatio(ratio: number): Promise<void> {
    if (!Number.isFinite(ratio) || ratio <= 0) {
      throw new Error("Tempo ratio must be positive.");
    }

    this.tempoRatio = ratio;

    if (this.disposed || !this.prepared) {
      return;
    }

    // Preserve ABCoda's logical position while abcjs destroys and
    // rebuilds its timer/midi buffer inside setWarp().
    this.storedProgress = this.progress();
    this.tempoChanging = true;

    try {
      await this.synth.setWarp(ratio * 100);

      if (this.disposed) {
        // setWarp() may have restarted playback internally after a
        // stale engine was already replaced.
        this.synth.pause();
        return;
      }

      // A seek may have happened while setWarp() was rebuilding.
      // The latest user-selected position wins.
      this.applyProgress();
    } finally {
      this.tempoChanging = false;
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;

    // Disable callbacks before touching abcjs so a late async
    // operation from this engine can no longer affect the active UI.
    this.disposed = true;
    this.onDispose();

    if (this.prepared) {
      this.synth.pause();
    }

    this.prepared = false;
    await Promise.resolve();
  }

  private applyProgress(): void {
    this.synth.setProgress(this.storedProgress);
    this.synth.seek(
      this.storedProgress,
      "percent",
    );
  }
}

function clampProgress(progress: number): number {
  return Math.max(
    0,
    Math.min(
      1,
      Number.isFinite(progress)
        ? progress
        : 0,
    ),
  );
}