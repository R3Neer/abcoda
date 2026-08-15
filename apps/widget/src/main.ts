import "./styles/index.css";
import { AbcjsEngraver } from "./adapters/abcjs/abcjs-engraver";
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

void controller.receive({
  schemaVersion: 2,
  revision: 1,
  document: {
    tuneId: "laboratory-1",
    title: "First architecture v2 vertical",
    voiceIds: ["RH", "LH"],
    source: {
      format: "abc",
      text: `X:1
T:First architecture v2 vertical
M:4/4
L:1/4
Q:1/4=84
V:RH clef=treble
V:LH clef=bass
%%score { RH LH }
K:C
[V:RH] C D E F|G A B c|]
[V:LH] C, D, E, F,|G, A, B, C|]`,
    },
  },
  diagnostics: [],
});

window.addEventListener("pagehide", () => controller.dispose(), { once: true });
