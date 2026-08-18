import type { ScorePresentationDto, ScoreSnapshotDto } from "@abcoda/contracts";
import type { InstrumentId } from "@abcoda/domain";
import type { HostPresentationContext } from "../../application/host-bridge";
import type { PlaybackSessionState } from "../../application/playback-session";
import type { ScoreSessionState } from "../../application/score-session";
import type { DraftSessionState } from "../../application/draft-session";
import type { VoiceMixSnapshot } from "../../application/voice-mix";
import type { VoiceRangeAssessment } from "../../application/voice-range";
import { requiredElement } from "./dom-elements";
import type {
  DraftActions,
  PlaybackActions,
  VoiceMixActions,
} from "./dom-widget-actions";
import { EditorView } from "./editor-view";
import { MixerView } from "./mixer-view";
import { TransportView } from "./transport-view";
import { WidgetShellView } from "./widget-shell-view";

export type { DraftActions, PlaybackActions, VoiceMixActions } from "./dom-widget-actions";

/**
 * Stable DOM facade consumed by the widget application layer.
 * Surface-specific DOM state and listeners live in dedicated subviews.
 */
export class DomWidgetView {
  readonly scoreViewport: HTMLElement;
  readonly scoreTarget: HTMLElement;
  readonly audioTarget: HTMLElement;

  private readonly shell: WidgetShellView;
  private readonly transport: TransportView;
  private readonly mixer: MixerView;
  private readonly editor: EditorView;

  constructor(private readonly documentObject: Document = document) {
    this.scoreViewport = requiredElement(this.documentObject, "score-shell");
    this.scoreTarget = requiredElement(this.documentObject, "score");
    this.audioTarget = requiredElement(this.documentObject, "abcjs-audio");
    this.shell = new WidgetShellView(this.documentObject);
    this.transport = new TransportView(
      this.documentObject,
      (message) => this.shell.showError(message),
    );
    this.mixer = new MixerView(this.documentObject);
    this.editor = new EditorView(this.documentObject);
  }

  showPresentation(
    presentation: ScorePresentationDto | undefined,
    snapshot: ScoreSnapshotDto,
  ): void {
    this.shell.showPresentation(presentation, snapshot);
  }

  showScore(state: ScoreSessionState): void {
    this.shell.showScore(state);
  }

  showPlayback(state: PlaybackSessionState): void {
    this.transport.show(state);
  }

  showMix(
    state: VoiceMixSnapshot,
    assessments: readonly VoiceRangeAssessment[] = [],
  ): void {
    this.mixer.show(state, assessments);
  }

  showDraft(state: DraftSessionState): void {
    this.editor.show(state);
  }

  applyHostContext(context: HostPresentationContext): void {
    this.shell.applyHostContext(context);
  }

  currentDraft(): string {
    return requiredElement<HTMLTextAreaElement>(this.documentObject, "abc-draft").value;
  }

  instrumentAssignments(): Readonly<Record<string, InstrumentId>> {
    const assignments: Record<string, InstrumentId> = {};
    for (const element of this.documentObject.querySelectorAll("select.voice-instrument[data-voice-id]")) {
      if (!(element instanceof HTMLSelectElement)) continue;
      const voiceId = element.getAttribute("data-voice-id");
      if (voiceId) assignments[voiceId] = element.value as InstrumentId;
    }
    return assignments;
  }

  bindPlayback(actions: PlaybackActions): () => void {
    return this.transport.bind(actions);
  }

  bindVoiceMix(actions: VoiceMixActions): () => void {
    return this.mixer.bind(actions);
  }

  bindDraft(actions: DraftActions): () => void {
    return this.editor.bind(actions);
  }
}
