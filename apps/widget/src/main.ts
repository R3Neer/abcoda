import "./styles/index.css";
import { AbcjsEngraver } from "./adapters/abcjs/abcjs-engraver";
import { CanonicalDraftTransformer } from "./adapters/local/canonical-draft-transformer";
import { DomWidgetView } from "./adapters/dom/dom-widget-view";
import { DomScoreCursor } from "./adapters/dom/dom-score-cursor";
import { createHostBridge } from "./adapters/host/create-host-bridge";
import { WidgetRuntime } from "./application/host-bridge";
import { PlaybackSessionController } from "./application/playback-session";
import { ScoreSessionController } from "./application/score-session";
import { ScoreCursorController } from "./application/score-cursor";
import {
  VoiceMixController,
} from "./application/voice-mix";
import { PlaybackMixCoordinator } from "./application/playback-mix-coordinator";
import { DraftSessionController } from "./application/draft-session";
import { LocalScoreEvaluator } from "./adapters/local/local-score-evaluator";
import {
  evaluateScoreResultSchema,
  type ScorePresentationDto,
} from "../../../packages/contracts/src/index";
import { assessVoiceRanges } from "./application/voice-range";
import { scoreStaffWidth } from "./application/score-layout";

const view = new DomWidgetView();
const cursorView = new DomScoreCursor(view.scoreTarget);
const cursor = new ScoreCursorController(cursorView);
let cursorBaseTempo = 96;
const playback = new PlaybackSessionController(96, 96, false, (state) => {
  view.showPlayback(state);
  cursor.setTempoRatio(state.tempo / cursorBaseTempo);
  cursor.setPlaying(
    (state.status === "ready" || state.status === "transitioning")
      && state.mode === "playing",
  );
});
const playbackMix = new PlaybackMixCoordinator(playback, (message) => {
  void playback.fail(message);
});
let voicePitches: Readonly<Record<string, readonly number[]>> = {};
let hostPresentation: ScorePresentationDto | undefined;
let cursorRevision = -1;
let renderedStaffWidth: number | undefined;
let activePreferredMeasuresPerLine: number | undefined;

const mix = new VoiceMixController((state) => {
  view.showMix(state, assessVoiceRanges(state, voicePitches));
  void playbackMix.apply(state);
});
const controller = new ScoreSessionController(
  new AbcjsEngraver(view.scoreTarget, view.audioTarget, {
    onPlaybackStarted: () => cursor.setPlaying(true),
    onPlaybackFinished: () => {
      const looping = playback.snapshot().loop;
      cursor.playbackFinished(looping);
      playback.playbackFinished();
    },
    onPlaybackEvent: (event) => cursor.onPlaybackEvent(event),
    onScoreSelection: (sourceOffsets) => {
      const progress = cursor.seekSourceOffsets(sourceOffsets);
      if (progress !== undefined) playback.seek(progress);
    },
  }),
  (state) => {
    if (state.status === "loading" || state.status === "invalid" || state.status === "failed") {
      voicePitches = {};
      playbackMix.clear();
      mix.adoptVoices(state.status === "loading" ? state.revision : 0, []);
      void playback.dispose();
    }
    view.showScore(state);
  },
  (snapshot, engraving, resultPresentation, reason) => {
    const presentation = resultPresentation ?? hostPresentation;
    if (engraving.timeline) {
      cursor.setTimeline(engraving.timeline, cursorRevision === snapshot.revision);
      cursorRevision = snapshot.revision;
    }

    activePreferredMeasuresPerLine = presentation?.preferredMeasuresPerLine;
    renderedStaffWidth = scoreStaffWidth(
      view.scoreTarget.clientWidth,
      activePreferredMeasuresPerLine,
    );

    if (reason === "reflow") return;

    const scoreTempo = snapshot.document.tempo?.bpm ?? 96;
    const effectiveTempo = presentation?.tempo ?? scoreTempo;
    cursorBaseTempo = scoreTempo;
    if (presentation) playback.setLoop(presentation.loop);
    voicePitches = engraving.voicePitches ?? {};
    playbackMix.adoptSource(engraving.playbackSource, scoreTempo, effectiveTempo);
    mix.adoptVoices(snapshot.revision, snapshot.document.voices, presentation);
    view.showPresentation(presentation, snapshot);
  },
);
const draft = new DraftSessionController(
  new LocalScoreEvaluator(),
  (state) => view.showDraft(state),
  (result) => { void controller.receive(result); },
  new CanonicalDraftTransformer(),
  700,
);
const runtime = new WidgetRuntime(
  controller,
  createHostBridge(),
  (context) => view.applyHostContext(context),
  (result) => {
    const parsed = evaluateScoreResultSchema.safeParse(result);
    if (parsed.success && parsed.data.status === "success" && parsed.data.snapshot) {
      hostPresentation = parsed.data.presentation;
      draft.adoptHostSnapshot(parsed.data.snapshot);
    } else {
      hostPresentation = undefined;
      draft.dispose();
    }
  },
);
let reflowTimer: ReturnType<typeof setTimeout> | undefined;
let observedScoreWidth = view.scoreTarget.clientWidth;

const resizeObserver = new ResizeObserver((entries) => {
  const width = entries.at(-1)?.contentRect.width ?? view.scoreTarget.clientWidth;

  // Ignore height-only changes caused by engraving itself.
  if (Math.abs(width - observedScoreWidth) < 0.5) return;
  observedScoreWidth = width;

  // CSS is scaling/recentring the existing SVG immediately. Keep the cursor
  // attached to the same musical point while that geometry changes.
  cursor.refreshGeometry();

  if (renderedStaffWidth === undefined) return;

  const nextStaffWidth = scoreStaffWidth(
    width,
    activePreferredMeasuresPerLine,
  );

  // Wide-window changes often don't alter the actual staff layout at all.
  if (Math.abs(nextStaffWidth - renderedStaffWidth) < 0.5) {
    if (reflowTimer) clearTimeout(reflowTimer);
    reflowTimer = undefined;
    return;
  }

  if (reflowTimer) clearTimeout(reflowTimer);

  reflowTimer = setTimeout(() => {
    reflowTimer = undefined;

    const stableStaffWidth = scoreStaffWidth(
      view.scoreTarget.clientWidth,
      activePreferredMeasuresPerLine,
    );

    if (
      renderedStaffWidth !== undefined
      && Math.abs(stableStaffWidth - renderedStaffWidth) < 0.5
    ) {
      cursor.refreshGeometry();
      return;
    }

    void controller.reflow();
  }, 320);
});

resizeObserver.observe(view.scoreTarget);
const unbindPlayback = view.bindPlayback({
  togglePlayback: () => { void playback.togglePlayback(); },
  rewind: () => { playback.rewind(); cursor.rewind(); },
  toggleLoop: () => playback.setLoop(!playback.snapshot().loop),
  setTempo: (tempo) => { void playback.setTempo(tempo); },
});
const unbindVoiceMix = view.bindVoiceMix({
  setInstrument: (voiceId, instrument) => mix.setInstrument(voiceId, instrument),
  setMuted: (voiceId, muted) => mix.setMuted(voiceId, muted),
});
const unbindDraft = view.bindDraft({
  edit: (text) => draft.edit(text),
  restoreVersion: (id) => draft.restoreVersion(id),
  commit: (label) => draft.commit(label),
  transpose: (semitones) => draft.transpose(semitones),
});
void runtime.start().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : "Could not connect to the host.";
  view.showScore({ status: "failed", message });
});

window.addEventListener("pagehide", () => {
  resizeObserver.disconnect();
  if (reflowTimer) clearTimeout(reflowTimer);
  unbindPlayback();
  unbindVoiceMix();
  unbindDraft();
  playbackMix.clear();
  void playback.dispose();
  draft.dispose();
  void runtime.dispose();
}, { once: true });
