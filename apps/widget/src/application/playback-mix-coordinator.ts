import type {
  PlaybackContinuity,
  PlaybackEngine,
  PlaybackSessionState,
} from "./playback-session";
import type { VoiceMixPlaybackSource, VoiceMixSnapshot } from "./voice-mix";

export interface PlaybackReconfigurationPort {
  captureContinuity(): PlaybackContinuity | undefined;
  snapshot(): PlaybackSessionState;
  configure(
    engine: PlaybackEngine,
    baseTempo: number,
    continuity?: PlaybackContinuity,
    tempo?: number,
  ): Promise<void>;
}

export class PlaybackMixCoordinator {
  private source: VoiceMixPlaybackSource | undefined;
  private baseTempo = 96;
  private generation = 0;
  private pendingScoreTempo: number | undefined;

  constructor(
    private readonly playback: PlaybackReconfigurationPort,
    private readonly onFailure: (message: string) => void,
  ) {}

  adoptSource(source: VoiceMixPlaybackSource | undefined, baseTempo: number): void {
    this.source = source;
    this.baseTempo = baseTempo;
    this.pendingScoreTempo = baseTempo;
    this.generation += 1;
  }

  clear(): void {
    this.source = undefined;
    this.pendingScoreTempo = undefined;
    this.generation += 1;
  }

  async apply(mix: VoiceMixSnapshot): Promise<void> {
    const source = this.source;
    if (!source || mix.voices.length === 0) return;
    const generation = ++this.generation;
    const continuity = this.playback.captureContinuity();
    const scoreTempo = this.pendingScoreTempo;
    try {
      const engine = await source.create(mix);
      if (generation !== this.generation || source !== this.source) {
        await engine.dispose();
        return;
      }
      this.pendingScoreTempo = undefined;
      await this.playback.configure(
        engine,
        this.baseTempo,
        continuity,
        scoreTempo ?? this.playback.snapshot().tempo,
      );
    } catch (error) {
      if (generation !== this.generation || source !== this.source) return;
      this.onFailure(error instanceof Error ? error.message : "Could not configure the playback mix.");
    }
  }
}
