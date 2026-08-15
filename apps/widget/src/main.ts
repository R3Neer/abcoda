import "./styles/index.css";
import { AbcjsEngraver } from "./adapters/abcjs/abcjs-engraver";
import { createHostBridge } from "./adapters/host/create-host-bridge";
import { WidgetRuntime } from "./application/host-bridge";
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

const controller = new ScoreSessionController(new AbcjsEngraver(score), showState);
const runtime = new WidgetRuntime(controller, createHostBridge());

void runtime.start().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : "Could not connect to the host.";
  document.body.dataset.state = "failed";
  status.value = "Host connection failed";
  error.textContent = message;
  error.hidden = false;
});

window.addEventListener("pagehide", () => {
  void runtime.dispose();
}, { once: true });
