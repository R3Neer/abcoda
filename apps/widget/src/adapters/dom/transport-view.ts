import type { PlaybackSessionState } from "../../application/playback-session";
import { requiredElement, requiredInside } from "./dom-elements";
import type { PlaybackActions } from "./dom-widget-actions";

export class TransportView {
  private readonly playbackButton: HTMLButtonElement;
  private readonly playIcon: SVGElement;
  private readonly pauseIcon: SVGElement;
  private readonly rewindButton: HTMLButtonElement;
  private readonly loopButton: HTMLButtonElement;
  private readonly tempoInput: HTMLInputElement;
  private readonly tempoValue: HTMLInputElement;

  constructor(
    documentObject: Document,
    private readonly reportError: (message: string) => void,
  ) {
    this.playbackButton = requiredElement(documentObject, "playback");
    this.playIcon = requiredInside(this.playbackButton, ".play-icon");
    this.pauseIcon = requiredInside(this.playbackButton, ".pause-icon");
    this.rewindButton = requiredElement(documentObject, "rewind");
    this.loopButton = requiredElement(documentObject, "loop");
    this.tempoInput = requiredElement(documentObject, "tempo");
    this.tempoValue = requiredElement(documentObject, "tempo-value");
  }

  show(state: PlaybackSessionState): void {
    const interactive = state.status === "ready";
    this.playbackButton.disabled = !interactive;
    this.rewindButton.disabled = !interactive;
    this.loopButton.disabled = !interactive;
    this.tempoInput.disabled = state.status === "configuring" || state.status === "transitioning";
    this.tempoValue.disabled = state.status === "configuring" || state.status === "transitioning";
    const playing = (state.status === "ready" || state.status === "transitioning")
      && state.mode === "playing";
    this.playIcon.toggleAttribute("hidden", playing);
    this.pauseIcon.toggleAttribute("hidden", !playing);
    this.playbackButton.setAttribute("aria-label", playing ? "Pause" : "Play");
    this.playbackButton.setAttribute("aria-pressed", String(playing));
    this.playbackButton.setAttribute("aria-busy", String(state.status === "transitioning"));
    this.playbackButton.title = playing ? "Pause" : "Play";
    this.loopButton.setAttribute("aria-pressed", String(state.loop));
    this.loopButton.setAttribute("aria-label", state.loop ? "Disable loop" : "Enable loop");
    this.loopButton.title = state.loop ? "Disable loop" : "Enable loop";
    this.tempoInput.value = String(state.tempo);
    this.tempoValue.value = String(state.tempo);
    if (state.status === "failed") this.reportError(state.message);
  }

  bind(actions: PlaybackActions): () => void {
    const togglePlayback = () => actions.togglePlayback();
    const rewind = () => actions.rewind();
    const toggleLoop = () => actions.toggleLoop();
    const previewSliderTempo = () => {
      this.tempoValue.value = this.tempoInput.value;
    };
    const previewTypedTempo = () => {
      if (this.tempoValue.validity.valid && this.tempoValue.value !== "") {
        this.tempoInput.value = this.tempoValue.value;
      }
    };
    const setSliderTempo = () => actions.setTempo(this.tempoInput.valueAsNumber);
    const setTypedTempo = () => {
      if (!this.tempoValue.validity.valid || this.tempoValue.value === "") {
        this.tempoValue.value = this.tempoInput.value;
        return;
      }
      this.tempoInput.value = this.tempoValue.value;
      actions.setTempo(this.tempoValue.valueAsNumber);
    };
    this.playbackButton.addEventListener("click", togglePlayback);
    this.rewindButton.addEventListener("click", rewind);
    this.loopButton.addEventListener("click", toggleLoop);
    this.tempoInput.addEventListener("input", previewSliderTempo);
    this.tempoInput.addEventListener("change", setSliderTempo);
    this.tempoValue.addEventListener("input", previewTypedTempo);
    this.tempoValue.addEventListener("change", setTypedTempo);
    return () => {
      this.playbackButton.removeEventListener("click", togglePlayback);
      this.rewindButton.removeEventListener("click", rewind);
      this.loopButton.removeEventListener("click", toggleLoop);
      this.tempoInput.removeEventListener("input", previewSliderTempo);
      this.tempoInput.removeEventListener("change", setSliderTempo);
      this.tempoValue.removeEventListener("input", previewTypedTempo);
      this.tempoValue.removeEventListener("change", setTypedTempo);
    };
  }
}
