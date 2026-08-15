export interface PlaybackEngine {
  play(): Promise<void>;
  pause(): Promise<void>;
  restart(): void;
  progress(): number;
  seek(progress: number): void;
  setLoop(enabled: boolean): void;
  setTempoRatio(ratio: number): Promise<void>;
  dispose(): Promise<void>;
}

interface PlaybackPreferences {
  readonly tempo: number;
  readonly loop: boolean;
}

export type PlaybackSessionState =
  | ({ readonly status: "unavailable" } & PlaybackPreferences)
  | ({ readonly status: "configuring" } & PlaybackPreferences)
  | ({ readonly status: "ready"; readonly mode: "paused" | "playing" } & PlaybackPreferences)
  | ({
      readonly status: "transitioning";
      readonly mode: "paused" | "playing";
      readonly intent: "play" | "pause" | "tempo";
    } & PlaybackPreferences)
  | ({ readonly status: "failed"; readonly message: string } & PlaybackPreferences);

export interface PlaybackContinuity {
  readonly progress: number;
  readonly playing: boolean;
}

export class PlaybackSessionController {
  private engine: PlaybackEngine | undefined;
  private baseTempo: number;
  private generation = 0;
  private state: PlaybackSessionState;

  constructor(
    baseTempo: number,
    tempo: number,
    loop: boolean,
    private readonly onState: (state: PlaybackSessionState) => void,
  ) {
    this.baseTempo = validTempo(baseTempo);
    this.state = { status: "unavailable", tempo: validTempo(tempo), loop };
    this.emit();
  }

  snapshot(): PlaybackSessionState {
    return { ...this.state };
  }

  captureContinuity(): PlaybackContinuity | undefined {
    if (!this.engine || this.state.status !== "ready") return undefined;
    return {
      progress: clampProgress(this.engine.progress()),
      playing: this.state.mode === "playing",
    };
  }

  async configure(
    engine: PlaybackEngine,
    baseTempo: number,
    continuity?: PlaybackContinuity,
    tempo: number = this.state.tempo,
  ): Promise<void> {
    const generation = ++this.generation;
    const previous = this.engine;
    this.engine = undefined;
    this.baseTempo = validTempo(baseTempo);
    this.state = { status: "configuring", tempo: validTempo(tempo), loop: this.state.loop };
    this.emit();

    try {
      await previous?.dispose();
      engine.setLoop(this.state.loop);
      await engine.setTempoRatio(this.state.tempo / this.baseTempo);
      if (generation !== this.generation) {
        await engine.dispose();
        return;
      }
      this.engine = engine;
      if (continuity) engine.seek(clampProgress(continuity.progress));
      this.state = {
        status: "ready",
        mode: "paused",
        tempo: this.state.tempo,
        loop: this.state.loop,
      };
      this.emit();
      if (continuity?.playing) await this.setPlaying(true);
    } catch (error) {
      await engine.dispose().catch(() => undefined);
      if (generation !== this.generation) return;
      this.engine = undefined;
      this.state = {
        status: "failed",
        tempo: this.state.tempo,
        loop: this.state.loop,
        message: errorMessage(error, "Audio configuration failed."),
      };
      this.emit();
    }
  }

  async togglePlayback(): Promise<void> {
    if (this.state.status !== "ready") return;
    await this.setPlaying(this.state.mode !== "playing");
  }

  rewind(): void {
    if (!this.engine || this.state.status !== "ready") return;
    this.engine.restart();
  }

  seek(progress: number): void {
    if (!this.engine || this.state.status !== "ready") return;
    this.engine.seek(clampProgress(progress));
  }

  setLoop(loop: boolean): void {
    this.state = { ...this.state, loop };
    if (this.engine && this.state.status === "ready") this.engine.setLoop(loop);
    this.emit();
  }

  async setTempo(tempo: number): Promise<void> {
    const nextTempo = validTempo(tempo);
    this.state = { ...this.state, tempo: nextTempo };
    this.emit();
    if (!this.engine || this.state.status !== "ready") return;

    const mode = this.state.mode;
    const engine = this.engine;
    const generation = this.generation;
    this.state = {
      status: "transitioning",
      intent: "tempo",
      mode,
      tempo: nextTempo,
      loop: this.state.loop,
    };
    this.emit();
    try {
      await engine.setTempoRatio(nextTempo / this.baseTempo);
      if (generation !== this.generation || engine !== this.engine) return;
      this.state = { status: "ready", mode, tempo: nextTempo, loop: this.state.loop };
    } catch (error) {
      if (generation !== this.generation || engine !== this.engine) return;
      this.state = {
        status: "failed",
        tempo: nextTempo,
        loop: this.state.loop,
        message: errorMessage(error, "Tempo change failed."),
      };
    }
    this.emit();
  }

  playbackFinished(): void {
    if (this.state.status !== "ready" || this.state.mode !== "playing") return;
    this.state = { ...this.state, mode: "paused" };
    this.emit();
  }

  async dispose(): Promise<void> {
    ++this.generation;
    const engine = this.engine;
    this.engine = undefined;
    this.state = { status: "unavailable", tempo: this.state.tempo, loop: this.state.loop };
    this.emit();
    await engine?.dispose();
  }

  private async setPlaying(playing: boolean): Promise<void> {
    if (!this.engine || this.state.status !== "ready") return;
    const engine = this.engine;
    const generation = this.generation;
    const previousMode = this.state.mode;
    const intent = playing ? "play" : "pause";
    this.state = {
      status: "transitioning",
      mode: playing ? "playing" : "paused",
      intent,
      tempo: this.state.tempo,
      loop: this.state.loop,
    };
    this.emit();
    try {
      if (playing) await engine.play();
      else await engine.pause();
      if (generation !== this.generation || engine !== this.engine) return;
      this.state = { ...this.state, status: "ready" };
    } catch (error) {
      if (generation !== this.generation || engine !== this.engine) return;
      this.state = {
        status: "failed",
        tempo: this.state.tempo,
        loop: this.state.loop,
        message: errorMessage(error, `${intent} failed.`),
      };
      if (previousMode === "playing") await engine.pause().catch(() => undefined);
    }
    this.emit();
  }

  private emit(): void {
    this.onState(this.snapshot());
  }
}

function validTempo(tempo: number): number {
  if (!Number.isInteger(tempo) || tempo < 20 || tempo > 300) {
    throw new Error("Tempo must be an integer from 20 to 300 BPM.");
  }
  return tempo;
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
