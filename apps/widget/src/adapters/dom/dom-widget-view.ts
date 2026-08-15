import type { HostPresentationContext } from "../../application/host-bridge";
import type { PlaybackSessionState } from "../../application/playback-session";
import type { ScoreSessionState } from "../../application/score-session";
import type { VoiceMixSnapshot } from "../../application/voice-mix";
import {
  instrumentsForVoice,
  type InstrumentId,
} from "../../../../../packages/domain/src/index";

export interface PlaybackActions {
  readonly togglePlayback: () => void;
  readonly rewind: () => void;
  readonly toggleLoop: () => void;
  readonly setTempo: (tempo: number) => void;
}

export interface VoiceMixActions {
  readonly setInstrument: (voiceId: string, instrument: InstrumentId) => void;
  readonly setMuted: (voiceId: string, muted: boolean) => void;
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
  private readonly mixer: HTMLElement;
  private readonly voiceMix: HTMLElement;

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
    this.mixer = this.required("mixer");
    this.voiceMix = this.required("voice-mix");
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

  showMix(state: VoiceMixSnapshot): void {
    this.mixer.hidden = state.voices.length === 0;
    this.voiceMix.replaceChildren(...state.voices.map((voice) => {
      const row = this.documentObject.createElement("div");
      row.className = "voice-mix-row";

      const name = this.documentObject.createElement("span");
      name.className = "voice-name";
      name.title = voice.id;
      name.textContent = voice.id;

      const select = this.documentObject.createElement("select");
      select.className = "voice-instrument";
      select.dataset.voiceId = voice.id;
      select.setAttribute("aria-label", `Instrument for ${voice.id}`);
      for (const instrument of instrumentsForVoice(voice.kind)) {
        const option = this.documentObject.createElement("option");
        option.value = instrument.id;
        option.textContent = instrument.label;
        option.selected = instrument.id === voice.instrument;
        select.appendChild(option);
      }

      const muteLabel = this.documentObject.createElement("label");
      muteLabel.className = "voice-mute";
      const mute = this.documentObject.createElement("input");
      mute.type = "checkbox";
      mute.dataset.voiceId = voice.id;
      mute.checked = voice.muted;
      mute.setAttribute("aria-label", `Mute ${voice.id}`);
      muteLabel.appendChild(mute);
      muteLabel.appendChild(this.documentObject.createTextNode("Mute"));
      row.appendChild(name);
      row.appendChild(select);
      row.appendChild(muteLabel);
      return row;
    }));
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

  bindVoiceMix(actions: VoiceMixActions): () => void {
    const onChange = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement && target.dataset.voiceId) {
        actions.setInstrument(target.dataset.voiceId, target.value as InstrumentId);
      }
      if (target instanceof HTMLInputElement && target.dataset.voiceId) {
        actions.setMuted(target.dataset.voiceId, target.checked);
      }
    };
    this.voiceMix.addEventListener("change", onChange);
    return () => this.voiceMix.removeEventListener("change", onChange);
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
