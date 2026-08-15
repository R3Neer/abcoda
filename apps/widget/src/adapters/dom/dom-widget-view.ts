import type { HostPresentationContext } from "../../application/host-bridge";
import type { PlaybackSessionState } from "../../application/playback-session";
import type { ScoreSessionState } from "../../application/score-session";

export interface PlaybackActions {
  readonly togglePlayback: () => void;
  readonly rewind: () => void;
  readonly toggleLoop: () => void;
  readonly setTempo: (tempo: number) => void;
}

export class DomWidgetView {
  readonly scoreTarget: HTMLElement;
  readonly audioTarget: HTMLElement;

  private readonly status: HTMLOutputElement;
  private readonly error: HTMLElement;
  private readonly playbackButton: HTMLButtonElement;
  private readonly rewindButton: HTMLButtonElement;
  private readonly loopButton: HTMLButtonElement;
  private readonly tempoInput: HTMLInputElement;
  private readonly tempoValue: HTMLOutputElement;

  constructor(private readonly documentObject: Document = document) {
    this.scoreTarget = this.required("score");
    this.audioTarget = this.required("abcjs-audio");
    this.status = this.required("status");
    this.error = this.required("error");
    this.playbackButton = this.required("playback");
    this.rewindButton = this.required("rewind");
    this.loopButton = this.required("loop");
    this.tempoInput = this.required("tempo");
    this.tempoValue = this.required("tempo-value");
  }

  showScore(state: ScoreSessionState): void {
    this.documentObject.body.dataset.state = state.status;
    this.error.hidden = true;
    if (state.status === "booting") this.status.value = "Booting";
    if (state.status === "loading") this.status.value = `Rendering revision ${state.revision}`;
    if (state.status === "ready") this.status.value = `Revision ${state.snapshot.revision} ready`;
    if (state.status === "invalid" || state.status === "failed") {
      this.status.value = state.status === "invalid" ? "Invalid result" : "Render failed";
      this.showError(state.message);
    }
  }

  showPlayback(state: PlaybackSessionState): void {
    const interactive = state.status === "ready";
    this.playbackButton.disabled = !interactive;
    this.rewindButton.disabled = !interactive;
    this.loopButton.disabled = !interactive;
    this.tempoInput.disabled = state.status === "configuring" || state.status === "transitioning";
    this.playbackButton.textContent = state.status === "ready" && state.mode === "playing"
      ? "Pause"
      : "Play";
    this.loopButton.setAttribute("aria-pressed", String(state.loop));
    this.tempoInput.value = String(state.tempo);
    this.tempoValue.value = `${state.tempo} BPM`;
    if (state.status === "failed") this.showError(state.message);
  }

  applyHostContext(context: HostPresentationContext): void {
    const root = this.documentObject.documentElement;
    if (context.theme) root.dataset.theme = context.theme;
    if (context.displayMode) root.dataset.displayMode = context.displayMode;
    const safeArea = context.safeAreaInsets;
    if (safeArea) {
      root.style.setProperty("--host-safe-top", `${safeArea.top}px`);
      root.style.setProperty("--host-safe-right", `${safeArea.right}px`);
      root.style.setProperty("--host-safe-bottom", `${safeArea.bottom}px`);
      root.style.setProperty("--host-safe-left", `${safeArea.left}px`);
    }
  }

  bindPlayback(actions: PlaybackActions): () => void {
    const togglePlayback = () => actions.togglePlayback();
    const rewind = () => actions.rewind();
    const toggleLoop = () => actions.toggleLoop();
    const setTempo = () => actions.setTempo(this.tempoInput.valueAsNumber);
    this.playbackButton.addEventListener("click", togglePlayback);
    this.rewindButton.addEventListener("click", rewind);
    this.loopButton.addEventListener("click", toggleLoop);
    this.tempoInput.addEventListener("change", setTempo);
    return () => {
      this.playbackButton.removeEventListener("click", togglePlayback);
      this.rewindButton.removeEventListener("click", rewind);
      this.loopButton.removeEventListener("click", toggleLoop);
      this.tempoInput.removeEventListener("change", setTempo);
    };
  }

  private showError(message: string): void {
    this.error.textContent = message;
    this.error.hidden = false;
  }

  private required<T extends HTMLElement>(id: string): T {
    const element = this.documentObject.getElementById(id);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing #${id}.`);
    return element as T;
  }
}
