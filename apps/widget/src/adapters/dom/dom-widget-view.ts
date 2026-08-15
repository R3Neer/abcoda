import type { HostPresentationContext } from "../../application/host-bridge";
import type { PlaybackSessionState } from "../../application/playback-session";
import type { ScoreSessionState } from "../../application/score-session";
import type { VoiceMixSnapshot } from "../../application/voice-mix";
import type { DraftSessionState } from "../../application/draft-session";
import type { VoiceRangeAssessment } from "../../application/voice-range";
import type {
  ScorePresentationDto,
  ScoreSnapshotDto,
} from "../../../../../packages/contracts/src/index";
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

export interface DraftActions {
  readonly edit: (draft: string) => void;
  readonly apply: () => void;
  readonly restoreLastGood: () => void;
  readonly restoreOriginal: () => void;
  readonly transpose: (semitones: number) => void;
}

export class DomWidgetView {
  readonly scoreTarget: HTMLElement;
  readonly audioTarget: HTMLElement;

  private readonly status: HTMLOutputElement;
  private readonly scoreTitle: HTMLElement;
  private readonly error: HTMLElement;
  private readonly playbackButton: HTMLButtonElement;
  private readonly rewindButton: HTMLButtonElement;
  private readonly loopButton: HTMLButtonElement;
  private readonly tempoInput: HTMLInputElement;
  private readonly tempoValue: HTMLOutputElement;
  private readonly mixer: HTMLElement;
  private readonly voiceMix: HTMLElement;
  private readonly editor: HTMLDetailsElement;
  private readonly editorState: HTMLOutputElement;
  private readonly draftInput: HTMLTextAreaElement;
  private readonly draftDiagnostics: HTMLElement;
  private readonly applyDraftButton: HTMLButtonElement;
  private readonly discardDraftButton: HTMLButtonElement;
  private readonly restoreOriginalButton: HTMLButtonElement;
  private readonly copyDraftButton: HTMLButtonElement;
  private readonly copyStatus: HTMLOutputElement;
  private readonly transposeButtons: readonly HTMLButtonElement[];

  constructor(private readonly documentObject: Document = document) {
    this.scoreTarget = this.required("score");
    this.audioTarget = this.required("abcjs-audio");
    this.status = this.required("status");
    this.scoreTitle = this.required("score-title");
    this.error = this.required("error");
    this.playbackButton = this.required("playback");
    this.rewindButton = this.required("rewind");
    this.loopButton = this.required("loop");
    this.tempoInput = this.required("tempo");
    this.tempoValue = this.required("tempo-value");
    this.mixer = this.required("mixer");
    this.voiceMix = this.required("voice-mix");
    this.editor = this.required("editor");
    this.editorState = this.required("editor-state");
    this.draftInput = this.required("abc-draft");
    this.draftDiagnostics = this.required("draft-diagnostics");
    this.applyDraftButton = this.required("apply-draft");
    this.discardDraftButton = this.required("discard-draft");
    this.restoreOriginalButton = this.required("restore-original");
    this.copyDraftButton = this.required("copy-draft");
    this.copyStatus = this.required("copy-status");
    this.transposeButtons = [
      "transpose-down-octave",
      "transpose-down",
      "transpose-up",
      "transpose-up-octave",
    ].map((id) => this.required<HTMLButtonElement>(id));
  }

  showPresentation(
    presentation: ScorePresentationDto | undefined,
    snapshot: ScoreSnapshotDto,
  ): void {
    this.scoreTitle.textContent = presentation?.title ?? snapshot.document.title ?? "ABCoda";
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

  showMix(
    state: VoiceMixSnapshot,
    assessments: readonly VoiceRangeAssessment[] = [],
  ): void {
    const active = this.documentObject.activeElement;
    const focusedVoice = active instanceof HTMLElement && this.voiceMix.contains(active)
      ? active.dataset.voiceId
      : undefined;
    const focusedRole = active instanceof HTMLSelectElement
      ? "instrument"
      : active instanceof HTMLInputElement && active.type === "checkbox"
        ? "mute"
        : undefined;
    let restoredFocus: HTMLSelectElement | HTMLInputElement | undefined;
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
      if (voice.id === focusedVoice && focusedRole === "instrument") restoredFocus = select;
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
      if (voice.id === focusedVoice && focusedRole === "mute") restoredFocus = mute;
      muteLabel.appendChild(mute);
      muteLabel.appendChild(this.documentObject.createTextNode("Mute"));
      row.appendChild(name);
      row.appendChild(select);
      row.appendChild(muteLabel);
      const assessment = assessments.find((candidate) => candidate.voiceId === voice.id);
      if (assessment?.message) {
        const warning = this.documentObject.createElement("p");
        warning.className = "voice-range-warning";
        warning.textContent = assessment.message;
        row.appendChild(warning);
      }
      return row;
    }));
    restoredFocus?.focus();
  }

  showDraft(state: DraftSessionState): void {
    this.editor.hidden = state.status === "unavailable";
    if (state.status === "unavailable") return;
    if (this.draftInput.value !== state.draft) this.draftInput.value = state.draft;
    this.editorState.value = state.status === "clean"
      ? `Revision ${state.lastGood.revision} saved`
      : state.status === "dirty"
        ? "Unsaved changes"
        : state.status === "validating"
          ? "Validating…"
          : "Needs attention";
    const busy = state.status === "validating";
    this.draftInput.disabled = busy;
    this.applyDraftButton.disabled = busy || state.status === "clean";
    this.discardDraftButton.disabled = busy || state.draft === state.lastGood.document.source.text;
    this.restoreOriginalButton.disabled = busy || (
      state.draft === state.original.document.source.text
      && state.lastGood.revision === state.original.revision
    );
    this.copyDraftButton.disabled = busy;
    for (const button of this.transposeButtons) button.disabled = busy;
    this.draftDiagnostics.replaceChildren(...(
      state.status === "invalid" ? state.diagnostics.map((diagnostic) => {
        const item = this.documentObject.createElement("li");
        const location = diagnostic.range
          ? `Line ${diagnostic.range.start.line}, column ${diagnostic.range.start.column}: `
          : "";
        item.textContent = `${location}${diagnostic.message}`;
        return item;
      }) : []
    ));
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

  bindDraft(actions: DraftActions): () => void {
    const edit = () => actions.edit(this.draftInput.value);
    const apply = () => actions.apply();
    const restoreLastGood = () => actions.restoreLastGood();
    const restoreOriginal = () => actions.restoreOriginal();
    const copy = () => { void this.copyDraft(); };
    const transposeListeners = this.transposeButtons.map((button) => {
      const transpose = () => actions.transpose(Number(button.dataset.semitones));
      button.addEventListener("click", transpose);
      return { button, transpose };
    });
    this.draftInput.addEventListener("input", edit);
    this.applyDraftButton.addEventListener("click", apply);
    this.discardDraftButton.addEventListener("click", restoreLastGood);
    this.restoreOriginalButton.addEventListener("click", restoreOriginal);
    this.copyDraftButton.addEventListener("click", copy);
    return () => {
      this.draftInput.removeEventListener("input", edit);
      this.applyDraftButton.removeEventListener("click", apply);
      this.discardDraftButton.removeEventListener("click", restoreLastGood);
      this.restoreOriginalButton.removeEventListener("click", restoreOriginal);
      this.copyDraftButton.removeEventListener("click", copy);
      for (const { button, transpose } of transposeListeners) {
        button.removeEventListener("click", transpose);
      }
    };
  }

  private async copyDraft(): Promise<void> {
    try {
      const clipboard = this.documentObject.defaultView?.navigator.clipboard;
      if (!clipboard) throw new Error("Clipboard access is unavailable.");
      await clipboard.writeText(this.draftInput.value);
      this.copyStatus.value = "Copied";
    } catch {
      this.copyStatus.value = "Copy failed";
    }
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
