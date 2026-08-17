import "./styles/index.css";
import "./styles/ranges.css";
import "./styles/openai-theme.css";
import { AbcjsEngraver } from "./adapters/abcjs/abcjs-engraver";
import { DomScoreCursor } from "./adapters/dom/dom-score-cursor";
import { applyVoiceRangePresentation } from "./adapters/dom/dom-range-presentation";
import { DomWidgetView } from "./adapters/dom/dom-widget-view";
import { createHostBridge } from "./adapters/host/create-host-bridge";
import { CanonicalDraftTransformer } from "./adapters/local/canonical-draft-transformer";
import { LocalScoreEvaluator } from "./adapters/local/local-score-evaluator";
import { WidgetSessionCoordinator } from "./application/widget-session-coordinator";

const view = new DomWidgetView();
const session = new WidgetSessionCoordinator({
  view,
  cursorView: new DomScoreCursor(view.scoreViewport),
  createEngraver: (callbacks) => new AbcjsEngraver(
    view.scoreTarget,
    view.audioTarget,
    callbacks,
  ),
  hostBridge: createHostBridge(),
  draftEvaluator: new LocalScoreEvaluator(),
  draftTransformer: new CanonicalDraftTransformer(),
  getViewportWidth: () => view.scoreViewport.clientWidth,
  presentVoiceRanges: (assessments) => {
    applyVoiceRangePresentation(document, assessments);
  },
  initialViewportWidth: view.scoreViewport.clientWidth,
});

const resizeObserver = new ResizeObserver((entries) => {
  session.viewportChanged(
    entries.at(-1)?.contentRect.width ?? view.scoreViewport.clientWidth,
  );
});
resizeObserver.observe(view.scoreViewport);

const unbindPlayback = view.bindPlayback({
  togglePlayback: () => session.togglePlayback(),
  rewind: () => session.rewind(),
  toggleLoop: () => session.toggleLoop(),
  setTempo: (tempo) => session.setTempo(tempo),
});
const unbindVoiceMix = view.bindVoiceMix({
  setInstrument: (voiceId, instrument) => {
    session.setInstrument(voiceId, instrument);
  },
  setMuted: (voiceId, muted) => session.setMuted(voiceId, muted),
  transposeVoice: (voiceId, semitones) => {
    session.transposeVoice(voiceId, semitones);
  },
});
const unbindDraft = view.bindDraft({
  edit: (text) => session.editDraft(text),
  restoreVersion: (id) => session.restoreDraftVersion(id),
  commit: (label) => session.commitDraft(label),
  transpose: (semitones) => session.transposeScore(semitones),
});

void session.start();

window.addEventListener("pagehide", () => {
  resizeObserver.disconnect();
  unbindPlayback();
  unbindVoiceMix();
  unbindDraft();
  session.dispose();
}, { once: true });
