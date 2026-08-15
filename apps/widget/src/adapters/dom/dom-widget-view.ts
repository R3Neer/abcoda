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
  readonly restoreVersion: (id: string) => void;
  readonly commit: (label: string) => boolean;
  readonly transpose: (semitones: number) => void;
}

export class DomWidgetView {
  readonly scoreTarget: HTMLElement;
  readonly audioTarget: HTMLElement;

  private readonly status: HTMLOutputElement;
  private readonly scoreTitle: HTMLElement;
  private readonly error: HTMLElement;
  private readonly playbackButton: HTMLButtonElement;
  private readonly playIcon: SVGElement;
  private readonly pauseIcon: SVGElement;
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
  private readonly versionHistory: HTMLElement;
  private readonly versionPicker: HTMLDetailsElement;
  private readonly beginCommitButton: HTMLButtonElement;
  private readonly commitForm: HTMLFormElement;
  private readonly commitMessage: HTMLInputElement;
  private readonly submitCommitButton: HTMLButtonElement;
  private readonly cancelCommitButton: HTMLButtonElement;
  private readonly copyDraftButton: HTMLButtonElement;
  private readonly copyIcon: SVGElement;
  private readonly copiedIcon: SVGElement;
  private readonly copyStatus: HTMLOutputElement;
  private readonly transposeButtons: readonly HTMLButtonElement[];
  private copyResetTimer: ReturnType<typeof setTimeout> | undefined;
  private draftStatus: DraftSessionState["status"] = "unavailable";

  constructor(private readonly documentObject: Document = document) {
    this.scoreTarget = this.required("score");
    this.audioTarget = this.required("abcjs-audio");
    this.status = this.required("status");
    this.scoreTitle = this.required("score-title");
    this.error = this.required("error");
    this.playbackButton = this.required("playback");
    this.playIcon = this.requiredInside(this.playbackButton, ".play-icon");
    this.pauseIcon = this.requiredInside(this.playbackButton, ".pause-icon");
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
    this.versionHistory = this.required("version-history");
    this.versionPicker = this.required("version-picker");
    this.beginCommitButton = this.required("begin-commit");
    this.commitForm = this.required("commit-form");
    this.commitMessage = this.required("commit-message");
    this.submitCommitButton = this.required("submit-commit");
    this.cancelCommitButton = this.required("cancel-commit");
    this.copyDraftButton = this.required("copy-draft");
    this.copyIcon = this.requiredInside(this.copyDraftButton, ".copy-icon");
    this.copiedIcon = this.requiredInside(this.copyDraftButton, ".copied-icon");
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
      : active instanceof HTMLButtonElement && active.classList.contains("voice-mute")
        ? "mute"
        : undefined;
    let restoredFocus: HTMLSelectElement | HTMLButtonElement | undefined;
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

      const mute = this.documentObject.createElement("button");
      mute.type = "button";
      mute.className = "voice-mute icon-button";
      mute.dataset.voiceId = voice.id;
      mute.setAttribute("aria-pressed", String(voice.muted));
      mute.setAttribute("aria-label", `${voice.muted ? "Unmute" : "Mute"} ${voice.id}`);
      mute.title = `${voice.muted ? "Unmute" : "Mute"} ${voice.id}`;
      mute.appendChild(muteIcon(this.documentObject, voice.muted));
      if (voice.id === focusedVoice && focusedRole === "mute") restoredFocus = mute;
      row.appendChild(name);
      row.appendChild(select);
      row.appendChild(mute);
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
    this.draftStatus = state.status;
    this.editor.hidden = state.status === "unavailable";
    if (state.status === "unavailable") return;
    if (this.draftInput.value !== state.draft) this.draftInput.value = state.draft;
    this.editorState.value = state.status === "clean"
      ? `Revision ${state.lastGood.revision} saved`
      : state.status === "dirty"
        ? "Saving soon…"
        : state.status === "validating"
          ? "Saving…"
          : "Not applied";
    const busy = state.status === "validating";
    this.updateCommitSubmit();
    this.editor.toggleAttribute("aria-busy", busy);
    this.versionHistory.replaceChildren(...state.history.map((version) => {
      const button = this.documentObject.createElement("button");
      button.type = "button";
      button.dataset.versionId = version.id;
      button.dataset.versionStatus = version.status;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(version.id === state.currentVersionId));
      const marker = this.documentObject.createElement("span");
      marker.className = "version-marker";
      marker.textContent = version.status === "invalid" ? "!" : "✓";
      const label = this.documentObject.createElement("span");
      label.textContent = version.label;
      button.appendChild(marker);
      button.appendChild(label);
      return button;
    }));
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
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("button.voice-mute")
        : null;
      if (target?.dataset.voiceId) {
        actions.setMuted(target.dataset.voiceId, target.getAttribute("aria-pressed") !== "true");
      }
    };
    this.voiceMix.addEventListener("change", onChange);
    this.voiceMix.addEventListener("click", onClick);
    return () => {
      this.voiceMix.removeEventListener("change", onChange);
      this.voiceMix.removeEventListener("click", onClick);
    };
  }

  bindDraft(actions: DraftActions): () => void {
    const edit = () => actions.edit(this.draftInput.value);
    const copy = () => { void this.copyDraft(); };
    const restoreVersion = (event: MouseEvent) => {
      const button = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("button[data-version-id]")
        : null;
      if (!button?.dataset.versionId) return;
      actions.restoreVersion(button.dataset.versionId);
      this.versionPicker.open = false;
    };
    let versionCloseTimer: ReturnType<typeof setTimeout> | undefined;
    const openVersions = () => {
      if (versionCloseTimer) clearTimeout(versionCloseTimer);
      versionCloseTimer = undefined;
      this.versionPicker.open = true;
    };
    const closeVersions = () => { this.versionPicker.open = false; };
    const scheduleVersionClose = () => {
      if (versionCloseTimer) clearTimeout(versionCloseTimer);
      versionCloseTimer = setTimeout(closeVersions, 180);
    };
    const keepVersionsOpen = (event: MouseEvent) => {
      event.preventDefault();
      openVersions();
    };
    const closeVersionsAfterFocus = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (!(next instanceof Node) || !this.versionPicker.contains(next)) closeVersions();
    };
    const beginCommit = () => {
      this.beginCommitButton.hidden = true;
      this.commitForm.hidden = false;
      this.commitMessage.focus();
      this.updateCommitSubmit();
    };
    const updateCommit = () => this.updateCommitSubmit();
    const submitCommit = (event: SubmitEvent) => {
      event.preventDefault();
      if (!actions.commit(this.commitMessage.value)) return;
      this.commitMessage.value = "";
      this.commitForm.hidden = true;
      this.beginCommitButton.hidden = false;
    };
    const closeCommit = () => {
      this.commitMessage.value = "";
      this.commitForm.hidden = true;
      this.beginCommitButton.hidden = false;
      this.beginCommitButton.focus();
    };
    const cancelCommitWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCommit();
    };
    const transposeListeners = this.transposeButtons.map((button) => {
      const transpose = () => actions.transpose(Number(button.dataset.semitones));
      button.addEventListener("click", transpose);
      return { button, transpose };
    });
    this.draftInput.addEventListener("input", edit);
    this.versionHistory.addEventListener("click", restoreVersion);
    this.copyDraftButton.addEventListener("click", copy);
    this.versionPicker.addEventListener("pointerenter", openVersions);
    this.versionPicker.addEventListener("pointerleave", scheduleVersionClose);
    this.versionHistory.addEventListener("pointerenter", openVersions);
    this.versionPicker.addEventListener("focusin", openVersions);
    this.versionPicker.addEventListener("focusout", closeVersionsAfterFocus);
    this.versionPicker.querySelector("summary")?.addEventListener("click", keepVersionsOpen);
    this.beginCommitButton.addEventListener("click", beginCommit);
    this.commitMessage.addEventListener("input", updateCommit);
    this.commitMessage.addEventListener("keydown", cancelCommitWithKeyboard);
    this.commitForm.addEventListener("submit", submitCommit);
    this.cancelCommitButton.addEventListener("click", closeCommit);
    return () => {
      this.draftInput.removeEventListener("input", edit);
      this.versionHistory.removeEventListener("click", restoreVersion);
      this.copyDraftButton.removeEventListener("click", copy);
      this.versionPicker.removeEventListener("pointerenter", openVersions);
      this.versionPicker.removeEventListener("pointerleave", scheduleVersionClose);
      this.versionHistory.removeEventListener("pointerenter", openVersions);
      this.versionPicker.removeEventListener("focusin", openVersions);
      this.versionPicker.removeEventListener("focusout", closeVersionsAfterFocus);
      this.versionPicker.querySelector("summary")?.removeEventListener("click", keepVersionsOpen);
      this.beginCommitButton.removeEventListener("click", beginCommit);
      this.commitMessage.removeEventListener("input", updateCommit);
      this.commitMessage.removeEventListener("keydown", cancelCommitWithKeyboard);
      this.commitForm.removeEventListener("submit", submitCommit);
      this.cancelCommitButton.removeEventListener("click", closeCommit);
      if (versionCloseTimer) clearTimeout(versionCloseTimer);
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
      for (const { button, transpose } of transposeListeners) {
        button.removeEventListener("click", transpose);
      }
    };
  }

  private updateCommitSubmit(): void {
    const stable = this.draftStatus === "clean" || this.draftStatus === "invalid";
    this.submitCommitButton.disabled = !stable || this.commitMessage.value.trim().length === 0;
  }

  private async copyDraft(): Promise<void> {
    try {
      const clipboard = this.documentObject.defaultView?.navigator.clipboard;
      if (!clipboard) throw new Error("Clipboard access is unavailable.");
      await clipboard.writeText(this.draftInput.value);
      this.copyStatus.value = "Copied";
      this.copyDraftButton.disabled = true;
      this.copyDraftButton.setAttribute("aria-label", "Copied");
      this.copyDraftButton.title = "Copied";
      this.copyIcon.toggleAttribute("hidden", true);
      this.copiedIcon.toggleAttribute("hidden", false);
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
      this.copyResetTimer = setTimeout(() => {
        this.copyResetTimer = undefined;
        this.copyDraftButton.disabled = false;
        this.copyDraftButton.setAttribute("aria-label", "Copy ABC");
        this.copyDraftButton.title = "Copy ABC";
        this.copyIcon.toggleAttribute("hidden", false);
        this.copiedIcon.toggleAttribute("hidden", true);
        this.copyStatus.value = "";
      }, 1400);
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

  private requiredInside<T extends Element>(parent: Element, selector: string): T {
    const element = parent.querySelector<T>(selector);
    if (!element) throw new Error(`Missing required element ${selector}.`);
    return element;
  }
}

function muteIcon(documentObject: Document, muted: boolean): SVGElement {
  const svg = documentObject.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "control-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = documentObject.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", muted
    ? "M4 9v6h4l5 4V5L8 9H4zm12.5.5L15 11l1.5 1.5L15 14l1.5 1.5L18 14l1.5 1.5L21 14l-1.5-1.5L21 11l-1.5-1.5L18 11l-1.5-1.5z"
    : "M4 9v6h4l5 4V5L8 9H4zm11.5 3a3.5 3.5 0 0 0-2-3.16v6.32a3.5 3.5 0 0 0 2-3.16zm-2-7.18v2.06a6 6 0 0 1 0 10.24v2.06a8 8 0 0 0 0-14.36z");
  svg.appendChild(path);
  return svg;
}
