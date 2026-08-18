import {
  instrumentsForVoice,
  type InstrumentId,
} from "@abcoda/domain";
import type { VoiceMixSnapshot } from "../../application/voice-mix";
import type { VoiceRangeAssessment } from "../../application/voice-range";
import { createTransposeControl } from "../../components/transpose-control";
import { requiredElement } from "./dom-elements";
import type { VoiceMixActions } from "./dom-widget-actions";

export class MixerView {
  private readonly mixer: HTMLElement;
  private readonly voiceMix: HTMLElement;
  private actions: VoiceMixActions | undefined;

  constructor(private readonly documentObject: Document) {
    this.mixer = requiredElement(this.documentObject, "mixer");
    this.voiceMix = requiredElement(this.documentObject, "voice-mix");
  }

  show(
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

      const transposeVoice = this.actions?.transposeVoice;
      const voiceTranspose = voice.kind === "pitched" && transposeVoice
        ? createTransposeControl(this.documentObject, {
            label: "Transpose",
            ariaLabel: `voice ${voice.id}`,
            onTranspose: (semitones) => transposeVoice(voice.id, semitones),
          })
        : createTransposeControl(this.documentObject, {
            label: "Transpose",
            ariaLabel: `voice ${voice.id}`,
            disabled: true,
            title: voice.kind === "unpitched_percussion"
              ? "Percussion voices are not transposed tonally."
              : "Per-voice transposition is unavailable.",
          });
      voiceTranspose.element.classList.add("voice-transpose");
      row.appendChild(voiceTranspose.element);

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

  instrumentAssignments(): Readonly<Record<string, InstrumentId>> {
    const assignments: Record<string, InstrumentId> = {};
    for (const element of this.voiceMix.querySelectorAll("select.voice-instrument[data-voice-id]")) {
      if (!(element instanceof HTMLSelectElement)) continue;
      const voiceId = element.getAttribute("data-voice-id");
      if (voiceId) assignments[voiceId] = element.value as InstrumentId;
    }
    return assignments;
  }

  bind(actions: VoiceMixActions): () => void {
    this.actions = actions;

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
      if (this.actions === actions) this.actions = undefined;
    };
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
