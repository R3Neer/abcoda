import "./styles/index.css";
import { AbcjsEngraver } from "./adapters/abcjs/abcjs-engraver";
import { createHostBridge } from "./adapters/host/create-host-bridge";
import { WidgetRuntime } from "./application/host-bridge";
import {
  PlaybackSessionController,
  type PlaybackSessionState,
} from "./application/playback-session";
import {
  ScoreSessionController,
  type ScoreSessionState,
} from "./application/score-session";

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing #${id}.`);
  return element as T;
}

const score = requiredElement<HTMLElement>("score");
const status = requiredElement<HTMLOutputElement>("status");
const error = requiredElement<HTMLElement>("error");
const audioHost = requiredElement<HTMLElement>("abcjs-audio");
const playbackButton = requiredElement<HTMLButtonElement>("playback");
const rewindButton = requiredElement<HTMLButtonElement>("rewind");
const loopButton = requiredElement<HTMLButtonElement>("loop");
const tempoInput = requiredElement<HTMLInputElement>("tempo");
const tempoValue = requiredElement<HTMLOutputElement>("tempo-value");

function showPlayback(state: PlaybackSessionState): void {
  const interactive = state.status === "ready";
  playbackButton.disabled = !interactive;
  rewindButton.disabled = !interactive;
  loopButton.disabled = !interactive;
  tempoInput.disabled = state.status === "configuring" || state.status === "transitioning";
  playbackButton.textContent = state.status === "ready" && state.mode === "playing" ? "Pause" : "Play";
  loopButton.setAttribute("aria-pressed", String(state.loop));
  tempoInput.value = String(state.tempo);
  tempoValue.value = `${state.tempo} BPM`;
  if (state.status === "failed") {
    error.textContent = state.message;
    error.hidden = false;
  }
}

const playback = new PlaybackSessionController(96, 96, false, showPlayback);

function showState(state: ScoreSessionState): void {
  document.body.dataset.state = state.status;
  error.hidden = true;

  if (state.status === "booting") status.value = "Booting";
  if (state.status === "loading") status.value = `Rendering revision ${state.revision}`;
  if (state.status === "ready") {
    status.value = `Revision ${state.snapshot.revision} ready`;
  }
  if (state.status === "invalid" || state.status === "failed") {
    status.value = state.status === "invalid" ? "Invalid result" : "Render failed";
    error.textContent = state.message;
    error.hidden = false;
  }
}

const controller = new ScoreSessionController(
  new AbcjsEngraver(score, audioHost, () => playback.playbackFinished()),
  showState,
  (snapshot, engraving) => {
    if (!engraving.playback) return;
    const tempo = snapshot.document.tempo?.bpm ?? 96;
    void playback.configure(engraving.playback, tempo, undefined, tempo);
  },
);
const runtime = new WidgetRuntime(controller, createHostBridge(), (context) => {
  if (context.theme) document.documentElement.dataset.theme = context.theme;
  if (context.displayMode) document.documentElement.dataset.displayMode = context.displayMode;
});

void runtime.start().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : "Could not connect to the host.";
  document.body.dataset.state = "failed";
  status.value = "Host connection failed";
  error.textContent = message;
  error.hidden = false;
});

window.addEventListener("pagehide", () => {
  void playback.dispose();
  void runtime.dispose();
}, { once: true });

playbackButton.addEventListener("click", () => {
  void playback.togglePlayback();
});
rewindButton.addEventListener("click", () => playback.rewind());
loopButton.addEventListener("click", () => playback.setLoop(!playback.snapshot().loop));
tempoInput.addEventListener("change", () => {
  void playback.setTempo(tempoInput.valueAsNumber);
});
