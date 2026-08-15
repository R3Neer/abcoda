import "./styles/index.css";
import { AbcjsEngraver } from "./adapters/abcjs/abcjs-engraver";
import { DomWidgetView } from "./adapters/dom/dom-widget-view";
import { DomScoreCursor } from "./adapters/dom/dom-score-cursor";
import { createHostBridge } from "./adapters/host/create-host-bridge";
import { WidgetRuntime } from "./application/host-bridge";
import { PlaybackSessionController } from "./application/playback-session";
import { ScoreSessionController } from "./application/score-session";
import { ScoreCursorController } from "./application/score-cursor";

const view = new DomWidgetView();
const cursorView = new DomScoreCursor(view.scoreTarget);
const cursor = new ScoreCursorController(cursorView);
const playback = new PlaybackSessionController(96, 96, false, (state) => {
  view.showPlayback(state);
  cursor.setPlaying(
    (state.status === "ready" || state.status === "transitioning") && state.mode === "playing",
  );
});

const controller = new ScoreSessionController(
  new AbcjsEngraver(view.scoreTarget, view.audioTarget, {
    onPlaybackStarted: () => cursor.setPlaying(true),
    onPlaybackFinished: () => {
      playback.playbackFinished();
      cursor.rewind();
    },
    onPlaybackEvent: (event) => cursor.onPlaybackEvent(event),
  }),
  (state) => {
    if (state.status === "loading" || state.status === "invalid" || state.status === "failed") {
      void playback.dispose();
    }
    view.showScore(state);
  },
  (snapshot, engraving) => {
    if (engraving.timeline) cursor.setTimeline(engraving.timeline);
    if (!engraving.playback) return;
    const tempo = snapshot.document.tempo?.bpm ?? 96;
    void playback.configure(engraving.playback, tempo, undefined, tempo);
  },
);
const runtime = new WidgetRuntime(controller, createHostBridge(), (context) => view.applyHostContext(context));
const unbindPlayback = view.bindPlayback({
  togglePlayback: () => { void playback.togglePlayback(); },
  rewind: () => { playback.rewind(); cursor.rewind(); },
  toggleLoop: () => playback.setLoop(!playback.snapshot().loop),
  setTempo: (tempo) => { void playback.setTempo(tempo); },
});
const unbindSeek = cursorView.bindSeek((x, y) => {
  const progress = cursor.seekPoint(x, y);
  if (progress !== undefined) playback.seek(progress);
}, (measure) => {
  const progress = cursor.seekMeasure(measure);
  if (progress !== undefined) playback.seek(progress);
});

void runtime.start().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : "Could not connect to the host.";
  view.showScore({ status: "failed", message });
});

window.addEventListener("pagehide", () => {
  unbindPlayback();
  unbindSeek();
  void playback.dispose();
  void runtime.dispose();
}, { once: true });
