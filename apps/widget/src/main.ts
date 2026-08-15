import "./styles/index.css";
import { AbcjsEngraver } from "./adapters/abcjs/abcjs-engraver";
import { DomWidgetView } from "./adapters/dom/dom-widget-view";
import { createHostBridge } from "./adapters/host/create-host-bridge";
import { WidgetRuntime } from "./application/host-bridge";
import { PlaybackSessionController } from "./application/playback-session";
import { ScoreSessionController } from "./application/score-session";

const view = new DomWidgetView();
const playback = new PlaybackSessionController(96, 96, false, (state) => view.showPlayback(state));

const controller = new ScoreSessionController(
  new AbcjsEngraver(view.scoreTarget, view.audioTarget, () => playback.playbackFinished()),
  (state) => {
    if (state.status === "loading" || state.status === "invalid" || state.status === "failed") {
      void playback.dispose();
    }
    view.showScore(state);
  },
  (snapshot, engraving) => {
    if (!engraving.playback) return;
    const tempo = snapshot.document.tempo?.bpm ?? 96;
    void playback.configure(engraving.playback, tempo, undefined, tempo);
  },
);
const runtime = new WidgetRuntime(controller, createHostBridge(), (context) => view.applyHostContext(context));
const unbindPlayback = view.bindPlayback({
  togglePlayback: () => { void playback.togglePlayback(); },
  rewind: () => playback.rewind(),
  toggleLoop: () => playback.setLoop(!playback.snapshot().loop),
  setTempo: (tempo) => { void playback.setTempo(tempo); },
});

void runtime.start().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : "Could not connect to the host.";
  view.showScore({ status: "failed", message });
});

window.addEventListener("pagehide", () => {
  unbindPlayback();
  void playback.dispose();
  void runtime.dispose();
}, { once: true });
