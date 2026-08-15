import {
  evaluateScoreResultSchema,
  type ScorePresentationDto,
  type ScoreSnapshotDto,
} from "@abcoda/contracts";
import type { InstrumentId } from "@abcoda/domain";
import {
  DraftSessionController,
  type DraftEvaluator,
  type DraftSessionState,
  type DraftTransformer,
} from "./draft-session";
import {
  WidgetRuntime,
  type HostBridge,
  type HostPresentationContext,
} from "./host-bridge";
import { PlaybackMixCoordinator } from "./playback-mix-coordinator";
import {
  PlaybackSessionController,
  type PlaybackSessionState,
} from "./playback-session";
import {
  ScoreCursorController,
  type CursorView,
  type PlaybackTimingCallback,
} from "./score-cursor";
import { scoreStaffWidth } from "./score-layout";
import {
  ScoreSessionController,
  type Engraver,
  type EngravingReason,
  type EngravingResult,
  type ScoreSessionState,
} from "./score-session";
import {
  VoiceMixController,
  type VoiceMixSnapshot,
} from "./voice-mix";
import {
  assessVoiceRanges,
  type VoiceRangeAssessment,
} from "./voice-range";

const DEFAULT_TEMPO = 96;
const DRAFT_DEBOUNCE_MS = 700;
const REFLOW_DEBOUNCE_MS = 320;
const WIDTH_EPSILON = 0.5;

export interface WidgetSessionView {
  showScore(state: ScoreSessionState): void;
  showPlayback(state: PlaybackSessionState): void;
  showMix(
    state: VoiceMixSnapshot,
    assessments?: readonly VoiceRangeAssessment[],
  ): void;
  showDraft(state: DraftSessionState): void;
  showPresentation(
    presentation: ScorePresentationDto | undefined,
    snapshot: ScoreSnapshotDto,
  ): void;
  applyHostContext(context: HostPresentationContext): void;
}

export interface RangeAwareEngraver extends Engraver {
  showVoiceRanges(state: VoiceMixSnapshot): void;
}

export interface WidgetEngraverCallbacks {
  readonly onPlaybackStarted: () => void;
  readonly onPlaybackFinished: () => void;
  readonly onPlaybackEvent: (event: PlaybackTimingCallback) => void;
  readonly onScoreSelection: (sourceOffsets: readonly number[]) => void;
}

export interface SessionTimerDriver {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

const defaultTimers: SessionTimerDriver = {
  schedule: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  cancel: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface WidgetSessionCoordinatorOptions {
  readonly view: WidgetSessionView;
  readonly cursorView: CursorView;
  readonly createEngraver: (callbacks: WidgetEngraverCallbacks) => RangeAwareEngraver;
  readonly hostBridge: HostBridge;
  readonly draftEvaluator: DraftEvaluator;
  readonly draftTransformer: DraftTransformer;
  readonly getViewportWidth: () => number;
  readonly presentVoiceRanges: (assessments: readonly VoiceRangeAssessment[]) => void;
  readonly initialViewportWidth?: number;
  readonly timers?: SessionTimerDriver;
}

/**
 * Owns only state that coordinates otherwise independent widget controllers.
 * Musical/session state remains owned by the specialized controllers.
 */
export class WidgetSessionCoordinator {
  private readonly view: WidgetSessionView;
  private readonly cursor: ScoreCursorController;
  private readonly playback: PlaybackSessionController;
  private readonly playbackMix: PlaybackMixCoordinator;
  private readonly engraver: RangeAwareEngraver;
  private readonly mix: VoiceMixController;
  private readonly score: ScoreSessionController;
  private readonly draft: DraftSessionController;
  private readonly runtime: WidgetRuntime;
  private readonly getViewportWidth: () => number;
  private readonly presentVoiceRanges: (assessments: readonly VoiceRangeAssessment[]) => void;
  private readonly timers: SessionTimerDriver;

  private cursorBaseTempo = DEFAULT_TEMPO;
  private voicePitches: Readonly<Record<string, readonly number[]>> = {};
  private hostPresentation: ScorePresentationDto | undefined;
  private cursorRevision = -1;
  private renderedStaffWidth: number | undefined;
  private preferredMeasuresPerLine: number | undefined;
  private observedScoreWidth: number;
  private reflowTimer: unknown;
  private disposed = false;

  constructor(options: WidgetSessionCoordinatorOptions) {
    this.view = options.view;
    this.getViewportWidth = options.getViewportWidth;
    this.presentVoiceRanges = options.presentVoiceRanges;
    this.timers = options.timers ?? defaultTimers;
    this.observedScoreWidth = options.initialViewportWidth ?? options.getViewportWidth();

    this.cursor = new ScoreCursorController(options.cursorView);
    this.playback = new PlaybackSessionController(
      DEFAULT_TEMPO,
      DEFAULT_TEMPO,
      false,
      (state) => this.onPlaybackState(state),
    );
    this.playbackMix = new PlaybackMixCoordinator(
      this.playback,
      (message) => { void this.playback.fail(message); },
    );
    this.engraver = options.createEngraver({
      onPlaybackStarted: () => this.cursor.setPlaying(true),
      onPlaybackFinished: () => {
        const looping = this.playback.snapshot().loop;
        this.cursor.playbackFinished(looping);
        this.playback.playbackFinished();
      },
      onPlaybackEvent: (event) => this.cursor.onPlaybackEvent(event),
      onScoreSelection: (sourceOffsets) => {
        const progress = this.cursor.seekSourceOffsets(sourceOffsets);
        if (progress !== undefined) this.playback.seek(progress);
      },
    });
    this.mix = new VoiceMixController((state) => this.onMixState(state));
    this.score = new ScoreSessionController(
      this.engraver,
      (state) => this.onScoreState(state),
      (snapshot, engraving, presentation, reason) => {
        this.onEngraved(snapshot, engraving, presentation, reason);
      },
    );
    this.draft = new DraftSessionController(
      options.draftEvaluator,
      (state) => this.view.showDraft(state),
      (result) => { void this.score.receive(result); },
      options.draftTransformer,
      DRAFT_DEBOUNCE_MS,
    );
    this.runtime = new WidgetRuntime(
      this.score,
      options.hostBridge,
      (context) => this.view.applyHostContext(context),
      (result) => this.receiveHostResult(result),
    );
  }

  async start(): Promise<void> {
    try {
      await this.runtime.start();
    } catch (cause) {
      const message = cause instanceof Error
        ? cause.message
        : "Could not connect to the host.";
      this.view.showScore({ status: "failed", message });
    }
  }

  receiveHostResult(result: unknown): void {
    const parsed = evaluateScoreResultSchema.safeParse(result);
    if (parsed.success && parsed.data.status === "success" && parsed.data.snapshot) {
      // A host result is a composition/session boundary. Local mix choices must
      // never leak from the previous composition into the next one.
      this.mix.adoptVoices(parsed.data.snapshot.revision, []);
      this.hostPresentation = parsed.data.presentation;
      this.draft.adoptHostSnapshot(parsed.data.snapshot);
      return;
    }

    this.hostPresentation = undefined;
    this.draft.dispose();
  }

  viewportChanged(width: number): void {
    if (this.disposed || Math.abs(width - this.observedScoreWidth) < WIDTH_EPSILON) return;
    this.observedScoreWidth = width;

    // The existing SVG is scaled/recentred by CSS immediately. Keep the cursor
    // attached while the delayed semantic reflow is pending.
    this.cursor.refreshGeometry();

    if (this.renderedStaffWidth === undefined) return;

    const nextStaffWidth = scoreStaffWidth(width, this.preferredMeasuresPerLine);
    if (Math.abs(nextStaffWidth - this.renderedStaffWidth) < WIDTH_EPSILON) {
      this.cancelReflow();
      return;
    }

    this.cancelReflow();
    this.reflowTimer = this.timers.schedule(() => {
      this.reflowTimer = undefined;
      if (this.disposed) return;
      const stableStaffWidth = scoreStaffWidth(
        this.getViewportWidth(),
        this.preferredMeasuresPerLine,
      );
      if (
        this.renderedStaffWidth !== undefined
        && Math.abs(stableStaffWidth - this.renderedStaffWidth) < WIDTH_EPSILON
      ) {
        this.cursor.refreshGeometry();
        return;
      }
      void this.score.reflow();
    }, REFLOW_DEBOUNCE_MS);
  }

  togglePlayback(): void {
    void this.playback.togglePlayback();
  }

  rewind(): void {
    this.playback.rewind();
    this.cursor.rewind();
  }

  toggleLoop(): void {
    this.playback.setLoop(!this.playback.snapshot().loop);
  }

  setTempo(tempo: number): void {
    void this.playback.setTempo(tempo);
  }

  setInstrument(voiceId: string, instrument: InstrumentId): void {
    this.mix.setInstrument(voiceId, instrument);
  }

  setMuted(voiceId: string, muted: boolean): void {
    this.mix.setMuted(voiceId, muted);
  }

  transposeVoice(voiceId: string, semitones: number): void {
    this.draft.transposeVoice(voiceId, semitones);
  }

  editDraft(text: string): void {
    this.draft.edit(text);
  }

  restoreDraftVersion(id: string): void {
    this.draft.restoreVersion(id);
  }

  commitDraft(label: string): boolean {
    return this.draft.commit(label);
  }

  transposeScore(semitones: number): void {
    this.draft.transpose(semitones);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelReflow();
    this.playbackMix.clear();
    void this.playback.dispose();
    this.draft.dispose();
    void this.runtime.dispose();
  }

  private onPlaybackState(state: PlaybackSessionState): void {
    this.view.showPlayback(state);
    this.cursor.setTempoRatio(state.tempo / this.cursorBaseTempo);
    this.cursor.setPlaying(
      (state.status === "ready" || state.status === "transitioning")
        && state.mode === "playing",
    );
  }

  private onMixState(state: VoiceMixSnapshot): void {
    const assessments = assessVoiceRanges(state, this.voicePitches);
    this.view.showMix(state, assessments);
    this.presentVoiceRanges(assessments);
    this.engraver.showVoiceRanges(state);
    void this.playbackMix.apply(state);
  }

  private onScoreState(state: ScoreSessionState): void {
    if (state.status === "loading") {
      this.voicePitches = {};
      this.playbackMix.clear();
      void this.playback.dispose();
    }

    if (state.status === "invalid" || state.status === "failed") {
      this.voicePitches = {};
      this.playbackMix.clear();
      this.mix.adoptVoices(0, []);
      void this.playback.dispose();
    }

    this.view.showScore(state);
  }

  private onEngraved(
    snapshot: ScoreSnapshotDto,
    engraving: EngravingResult,
    resultPresentation: ScorePresentationDto | undefined,
    reason: EngravingReason,
  ): void {
    const presentation = resultPresentation ?? this.hostPresentation;

    if (engraving.timeline) {
      this.cursor.setTimeline(
        engraving.timeline,
        this.cursorRevision === snapshot.revision,
      );
      this.cursorRevision = snapshot.revision;
    }

    this.preferredMeasuresPerLine = presentation?.preferredMeasuresPerLine;
    this.renderedStaffWidth = scoreStaffWidth(
      this.getViewportWidth(),
      this.preferredMeasuresPerLine,
    );

    if (reason === "reflow") {
      this.engraver.showVoiceRanges(this.mix.snapshot());
      return;
    }

    const scoreTempo = snapshot.document.tempo?.bpm ?? DEFAULT_TEMPO;
    const effectiveTempo = presentation?.tempo ?? scoreTempo;
    this.cursorBaseTempo = scoreTempo;
    if (presentation) this.playback.setLoop(presentation.loop);
    this.voicePitches = engraving.voicePitches ?? {};
    this.playbackMix.adoptSource(
      engraving.playbackSource,
      scoreTempo,
      effectiveTempo,
    );
    this.mix.adoptVoices(
      snapshot.revision,
      snapshot.document.voices,
      presentation,
    );
    this.view.showPresentation(presentation, snapshot);
  }

  private cancelReflow(): void {
    if (this.reflowTimer === undefined) return;
    this.timers.cancel(this.reflowTimer);
    this.reflowTimer = undefined;
  }
}
