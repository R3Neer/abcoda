import "./styles/index.css";
import { AbcjsEngraver } from "./adapters/abcjs/abcjs-engraver";
import { AbcjsDraftTransformer } from "./adapters/abcjs/abcjs-draft-transformer";
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

const view = new DomWidgetView();
const cursorView = new DomScoreCursor(view.scoreTarget);
const cursor = new ScoreCursorController(cursorView);
const playback = new PlaybackSessionController(96, 96, false, (state) => {
  view.showPlayback(state);
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

const mix = new VoiceMixController((state) => {
  view.showMix(state, assessVoiceRanges(state, voicePitches));
  void playbackMix.apply(state);
});
const controller = new ScoreSessionController(
  new AbcjsEngraver(view.scoreTarget, view.audioTarget, {
    onPlaybackStarted: () => cursor.setPlaying(true),
    onPlaybackFinished: () => {
      playback.playbackFinished();
      cursor.finish();
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
  (snapshot, engraving, resultPresentation) => {
    const presentation = resultPresentation ?? hostPresentation;
    if (engraving.timeline) cursor.setTimeline(engraving.timeline);
    const tempo = presentation?.tempo ?? snapshot.document.tempo?.bpm ?? 96;
    if (presentation) playback.setLoop(presentation.loop);
    voicePitches = engraving.voicePitches ?? {};
    playbackMix.adoptSource(engraving.playbackSource, tempo);
    mix.adoptVoices(snapshot.revision, snapshot.document.voices, presentation);
    view.showPresentation(presentation, snapshot);
  },
);
const draft = new DraftSessionController(
  new LocalScoreEvaluator(),
  (state) => view.showDraft(state),
  (result) => { void controller.receive(result); },
  new AbcjsDraftTransformer(),
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
  unbindPlayback();
  unbindVoiceMix();
  unbindDraft();
  void playback.dispose();
  draft.dispose();
  void runtime.dispose();
}, { once: true });
