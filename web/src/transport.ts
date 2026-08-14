export interface PlaybackBackend {
  play(): Promise<void> | void;
  pause(): Promise<void> | void;
  restart(): void;
  setProgress(percent: number): void;
  toggleLoop(): void;
  setWarp(percent: number): Promise<void> | void;
}

export interface TransportState {
  ready: boolean;
  busy: boolean;
  playing: boolean;
  loop: boolean;
  tempo: number;
}

export class TransportController {
  private backend: PlaybackBackend | undefined;
  private backendLoop = false;
  private state: TransportState;

  constructor(
    private baseTempo: number,
    tempo: number,
    loop: boolean,
    private readonly onChange: (state: TransportState) => void,
  ) {
    this.state = { ready: false, busy: false, playing: false, loop, tempo };
    this.emit();
  }

  snapshot(): TransportState {
    return { ...this.state };
  }

  private emit(): void {
    this.onChange(this.snapshot());
  }

  reset(baseTempo: number, tempo: number, loop: boolean): void {
    this.backend = undefined;
    this.backendLoop = false;
    this.baseTempo = baseTempo;
    this.state = { ready: false, busy: false, playing: false, loop, tempo };
    this.emit();
  }

  beginConfiguration(): void {
    this.state.playing = false;
    this.state.ready = false;
    this.state.busy = true;
    this.emit();
  }

  async completeConfiguration(backend: PlaybackBackend): Promise<void> {
    if (this.backend !== backend) this.backendLoop = false;
    this.backend = backend;
    if (this.state.loop !== this.backendLoop) {
      backend.toggleLoop();
      this.backendLoop = this.state.loop;
    }
    await backend.setWarp((this.state.tempo / this.baseTempo) * 100);
    this.state.ready = true;
    this.state.busy = false;
    this.emit();
  }

  failConfiguration(): void {
    this.state.ready = false;
    this.state.busy = false;
    this.state.playing = false;
    this.emit();
  }

  play(): void {
    if (!this.backend || !this.state.ready || this.state.busy || this.state.playing) return;
    this.state.playing = true;
    this.emit();
    try {
      this.backend.play();
    } catch (error) {
      this.state.playing = false;
      this.emit();
      throw error;
    }
  }

  async togglePlayback(): Promise<void> {
    if (!this.backend || !this.state.ready || this.state.busy) return;
    const wasPlaying = this.state.playing;
    this.state.busy = true;
    this.state.playing = !wasPlaying;
    this.emit();
    try {
      if (wasPlaying) await this.backend.pause();
      else await this.backend.play();
    } catch (error) {
      this.state.playing = wasPlaying;
      throw error;
    } finally {
      this.state.busy = false;
      this.emit();
    }
  }

  rewind(): void {
    if (!this.backend || !this.state.ready || this.state.busy) return;
    this.backend.restart();
  }

  seek(progress: number): void {
    if (!this.backend || !this.state.ready || this.state.busy) return;
    this.backend.setProgress(Math.max(0, Math.min(1, progress)));
  }

  pause(): void {
    if (!this.backend || !this.state.ready || this.state.busy || !this.state.playing) return;
    this.backend.pause();
    this.state.playing = false;
    this.emit();
  }

  toggleLoop(): void {
    this.state.loop = !this.state.loop;
    if (this.backend && this.state.ready && !this.state.busy) {
      this.backend.toggleLoop();
      this.backendLoop = this.state.loop;
    }
    this.emit();
  }

  async setTempo(tempo: number): Promise<void> {
    this.state.tempo = tempo;
    this.emit();
    if (this.backend && this.state.ready && !this.state.busy) {
      await this.backend.setWarp((tempo / this.baseTempo) * 100);
    }
  }

  playbackStarted(): void {
    if (!this.state.ready) return;
    this.state.playing = true;
    this.emit();
  }

  playbackFinished(): void {
    this.state.playing = false;
    this.emit();
  }
}
