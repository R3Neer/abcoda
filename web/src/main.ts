import ABCJS from "abcjs";
import {
  App,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import {
  instrumentNames,
  renderScoreInputSchema,
  renderScoreOutputSchema,
  type InstrumentName,
  type RenderScoreOutput,
  type SelectionContext,
} from "../../shared/score";
import { abcTitle, extractVoiceIds } from "../../shared/voices";
import { applyInstruments, fingerprint, measureFromClasses } from "./music";
import "./style.css";

const sample: RenderScoreOutput = {
  schemaVersion: 1,
  voiceIds: ["RH", "LH"],
  warnings: [],
  score: {
    schemaVersion: 1,
    abc: `X:1\nT:ABCoda demo\nM:4/4\nL:1/8\nQ:1/4=96\nK:C\n%%score { RH LH }\nV:RH clef=treble name="Piano"\nV:LH clef=bass\n[V:RH] C2 E2 G2 c2 | d2 c2 B2 G2 | c8 |]\n[V:LH] C,4 G,4 | F,4 G,4 | C,8 |]`,
    playback: {
      tempo: 96,
      instruments: { RH: "acoustic_grand_piano", LH: "acoustic_grand_piano" },
      mutedVoices: [],
      loop: false,
    },
    display: { title: "ABCoda demo", coloredVoices: true },
  },
};

const app = new App({ name: "ABCoda score", version: "0.1.0" });
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scoreElement = byId<HTMLElement>("score");
const notice = byId<HTMLElement>("notice");
const tempo = byId<HTMLInputElement>("tempo");
const tempoOutput = byId<HTMLOutputElement>("tempo-output");
const selectionSummary = byId<HTMLElement>("selection-summary");
const explainButton = byId<HTMLButtonElement>("explain-selection");
const clearButton = byId<HTMLButtonElement>("clear-selection");
const loopButton = byId<HTMLButtonElement>("loop");

let payload: RenderScoreOutput | undefined;
let visualTune: ABCJS.TuneObject | undefined;
let synth: ABCJS.SynthObjectController | undefined;
let currentTempo = 96;
let baseTempo = 96;
let playing = false;
let loopEnabled = false;
let synthLoopEnabled = false;
let scoreHash = "";
let instruments: Record<string, InstrumentName> = {};
let mutedVoices = new Set<string>();

type ChatGptBridge = {
  toolInput?: unknown;
  toolOutput?: unknown;
  notifyIntrinsicHeight?: (height: number) => void;
  sendFollowUpMessage?: (options: { prompt: string; scrollToBottom?: boolean }) => Promise<void>;
  requestDisplayMode?: (options: { mode: "inline" | "fullscreen" | "pip" }) => Promise<unknown>;
  openExternal?: (options: { href: string }) => Promise<void>;
};

const getChatGpt = () => (window as Window & { openai?: ChatGptBridge }).openai;

type SelectedItem = {
  key: string;
  measure: number;
  voice: string;
  line: number;
  startChar?: number;
  endChar?: number;
  element: HTMLElement;
};
const selected = new Map<string, SelectedItem>();

function showNotice(message: string, error = false): void {
  notice.textContent = message;
  notice.hidden = message.length === 0;
  notice.classList.toggle("error", error);
}

function applyHostContext(context: McpUiHostContext): void {
  if (context.theme) document.documentElement.dataset.theme = context.theme;
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
  if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
}

function clearPlayingCursor(): void {
  scoreElement.querySelectorAll(".abcoda-playing").forEach((node) => node.classList.remove("abcoda-playing"));
}

const cursorControl: ABCJS.CursorControl = {
  onStart: () => { playing = true; },
  onFinished: () => { playing = false; clearPlayingCursor(); },
  onEvent: (event) => {
    clearPlayingCursor();
    event.elements?.flat().forEach((element) => element.classList.add("abcoda-playing"));
  },
};

async function configureAudio(): Promise<void> {
  if (!payload || !visualTune) return;
  if (playing) synth?.pause();
  playing = false;
  clearPlayingCursor();
  if (!ABCJS.synth.supportsAudio()) {
    showNotice("Audio playback is not available in this browser context.", true);
    return;
  }
  synth ??= new ABCJS.synth.SynthController();
  synth.load("#abcjs-audio", cursorControl, {
    displayLoop: false,
    displayPlay: false,
    displayProgress: false,
    displayRestart: false,
    displayWarp: false,
  });
  const result = await synth.setTune(visualTune, false, {
    qpm: baseTempo,
    chordsOff: true,
    sequenceCallback: (sequence) =>
      applyInstruments(sequence, payload?.voiceIds ?? [], instruments, mutedVoices),
  });
  if (result.status === "no-audio-context") {
    showNotice("Tap Play to enable audio.");
  }
  if (loopEnabled !== synthLoopEnabled) {
    synth.toggleLoop();
    synthLoopEnabled = loopEnabled;
  }
  await synth.setWarp((currentTempo / baseTempo) * 100);
}

function selectionSnapshot(): SelectionContext {
  const items = [...selected.values()];
  return {
    type: "abcoda.score_selection",
    schemaVersion: 1,
    scoreFingerprint: scoreHash,
    selection: {
      selectedMeasures: [...new Set(items.map((item) => item.measure))].sort((a, b) => a - b),
      selectedVoices: [...new Set(items.map((item) => item.voice))],
      selectedElements: items.map(({ measure, voice, line, startChar, endChar }) => ({
        measure,
        voice,
        line,
        ...(startChar === undefined ? {} : { startChar }),
        ...(endChar === undefined ? {} : { endChar }),
      })),
    },
  };
}

async function publishSelection(): Promise<void> {
  const snapshot = selectionSnapshot();
  const count = snapshot.selection.selectedElements.length;
  const measures = snapshot.selection.selectedMeasures.join(", ");
  selectionSummary.textContent = count === 0
    ? "Select notes or measures to discuss them."
    : `${count} element${count === 1 ? "" : "s"} selected · measure${snapshot.selection.selectedMeasures.length === 1 ? "" : "s"} ${measures}`;
  explainButton.disabled = count === 0;
  clearButton.disabled = count === 0;
  try {
    await app.updateModelContext({ structuredContent: snapshot });
  } catch {
    // Standalone demo mode has no host; the local interaction still works.
  }
}

function clearSelection(): void {
  selected.forEach(({ element }) => element.classList.remove("abcoda-selected"));
  selected.clear();
  void publishSelection();
}

function handleScoreClick(
  abcElement: ABCJS.AbcElem,
  _tuneNumber: number,
  classes: string,
  analysis: ABCJS.ClickListenerAnalysis,
): void {
  if (!payload) return;
  const element = analysis.selectableElement;
  const measure = measureFromClasses(classes, analysis.measure);
  const voice = payload.voiceIds[analysis.voice] ?? payload.voiceIds[0] ?? "default";
  const startChar = "startChar" in abcElement && typeof abcElement.startChar === "number" ? abcElement.startChar : undefined;
  const endChar = "endChar" in abcElement && typeof abcElement.endChar === "number" ? abcElement.endChar : undefined;
  const key = `${voice}:${measure}:${startChar ?? analysis.line}:${endChar ?? analysis.measure}`;

  if (selected.has(key)) {
    selected.get(key)?.element.classList.remove("abcoda-selected");
    selected.delete(key);
  } else {
    element.classList.add("abcoda-selected");
    selected.set(key, {
      key,
      measure,
      voice,
      line: analysis.line,
      ...(startChar === undefined ? {} : { startChar }),
      ...(endChar === undefined ? {} : { endChar }),
      element,
    });
  }
  void publishSelection();
}

function renderMixer(): void {
  if (!payload) return;
  const container = byId<HTMLElement>("voice-controls");
  container.replaceChildren();
  payload.voiceIds.forEach((voiceId) => {
    const row = document.createElement("div");
    row.className = "voice-row";
    const name = document.createElement("span");
    name.className = "voice-name";
    name.textContent = voiceId;
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Instrument for ${voiceId}`);
    instrumentNames.forEach((instrument) => {
      const option = document.createElement("option");
      option.value = instrument;
      option.textContent = instrument.replaceAll("_", " ");
      option.selected = (instruments[voiceId] ?? "acoustic_grand_piano") === instrument;
      select.append(option);
    });
    select.addEventListener("change", () => {
      instruments[voiceId] = select.value as InstrumentName;
      void configureAudio();
    });
    const muteLabel = document.createElement("label");
    muteLabel.className = "mute-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = mutedVoices.has(voiceId);
    checkbox.addEventListener("change", () => {
      checkbox.checked ? mutedVoices.add(voiceId) : mutedVoices.delete(voiceId);
      void configureAudio();
    });
    muteLabel.append(checkbox, "Mute");
    row.append(name, select, muteLabel);
    container.append(row);
  });
}

async function render(output: RenderScoreOutput): Promise<void> {
  payload = output;
  clearSelection();
  scoreHash = fingerprint(output.score.abc);
  baseTempo = output.score.playback.tempo;
  currentTempo = baseTempo;
  instruments = { ...output.score.playback.instruments };
  mutedVoices = new Set(output.score.playback.mutedVoices);
  loopEnabled = output.score.playback.loop;
  loopButton.setAttribute("aria-pressed", String(loopEnabled));
  tempo.value = String(currentTempo);
  tempoOutput.value = `${currentTempo} BPM`;
  byId<HTMLElement>("score-title").textContent = output.score.display.title ?? abcTitle(output.score.abc) ?? "Interactive score";
  scoreElement.classList.toggle("colored-voices", output.score.display.coloredVoices);
  showNotice(output.warnings.join(" "));

  const measuresPerLine = output.score.display.preferredMeasuresPerLine ?? (window.innerWidth < 620 ? 2 : 4);
  const tunes = ABCJS.renderAbc(scoreElement, output.score.abc, {
    responsive: "resize",
    add_classes: true,
    clickListener: handleScoreClick,
    foregroundColor: "currentColor",
    wrap: {
      preferredMeasuresPerLine: measuresPerLine,
      minSpacing: 1.7,
      maxSpacing: 2.8,
    },
  });
  visualTune = tunes[0];
  if (!visualTune) {
    showNotice("The score could not be rendered.", true);
    return;
  }
  renderMixer();
  await configureAudio();
}

byId<HTMLButtonElement>("play").addEventListener("click", () => {
  if (!synth) return;
  if (!playing) synth.play();
});
byId<HTMLButtonElement>("pause").addEventListener("click", () => synth?.pause());
byId<HTMLButtonElement>("stop").addEventListener("click", () => {
  if (playing) synth?.pause();
  synth?.restart();
  playing = false;
  clearPlayingCursor();
});
loopButton.addEventListener("click", () => {
  loopEnabled = !loopEnabled;
  loopButton.setAttribute("aria-pressed", String(loopEnabled));
  synth?.toggleLoop();
  synthLoopEnabled = loopEnabled;
});
tempo.addEventListener("input", () => {
  currentTempo = Number(tempo.value);
  tempoOutput.value = `${currentTempo} BPM`;
  void synth?.setWarp((currentTempo / baseTempo) * 100);
});
clearButton.addEventListener("click", clearSelection);
explainButton.addEventListener("click", async () => {
  await publishSelection();
  try {
    const bridge = getChatGpt();
    if (bridge?.sendFollowUpMessage) {
      await bridge.sendFollowUpMessage({
        prompt: "Explícame musicalmente la selección actual de la partitura.",
      });
    } else {
      await app.sendMessage({
        role: "user",
        content: [{ type: "text", text: "Explícame musicalmente la selección actual de la partitura." }],
      });
    }
  } catch {
    showNotice("The host did not accept the follow-up message.", true);
  }
});
byId<HTMLButtonElement>("fullscreen").addEventListener("click", async () => {
  try {
    const bridge = getChatGpt();
    if (bridge?.requestDisplayMode) await bridge.requestDisplayMode({ mode: "fullscreen" });
    else await app.requestDisplayMode({ mode: "fullscreen" });
  } catch { /* optional host capability */ }
});
byId<HTMLButtonElement>("sample-credits").addEventListener("click", async () => {
  try {
    const bridge = getChatGpt();
    if (bridge?.openExternal) {
      await bridge.openExternal({ href: "https://github.com/gleitz/midi-js-soundfonts" });
    } else {
      await app.openLink({ url: "https://github.com/gleitz/midi-js-soundfonts" });
    }
  } catch {
    // Link opening is optional in standalone and restricted hosts.
  }
});

app.onhostcontextchanged = applyHostContext;
app.ontoolinput = (params) => {
  const direct = renderScoreOutputSchema.safeParse(params.arguments);
  if (direct.success) void render(direct.data);
};
app.ontoolresult = (params) => {
  const result = renderScoreOutputSchema.safeParse(params.structuredContent);
  if (result.success) void render(result.data);
};

function renderFromChatGptGlobals(globals: ChatGptBridge): void {
  const output = renderScoreOutputSchema.safeParse(globals.toolOutput);
  if (output.success) {
    void render(output.data);
    return;
  }

  const input = renderScoreInputSchema.safeParse(globals.toolInput);
  if (input.success) {
    void render({
      schemaVersion: 1,
      score: input.data,
      voiceIds: extractVoiceIds(input.data.abc),
      warnings: [],
    });
  }
}

const initialChatGpt = getChatGpt();
if (initialChatGpt) renderFromChatGptGlobals(initialChatGpt);
window.addEventListener("openai:set_globals", ((event: CustomEvent<{ globals?: ChatGptBridge }>) => {
  if (event.detail?.globals) {
    renderFromChatGptGlobals(event.detail.globals);
    setupChatGptHeightNotifications();
  }
}) as EventListener, { passive: true });

let chatGptHeightObserver: ResizeObserver | undefined;
function setupChatGptHeightNotifications(): void {
  const bridge = getChatGpt();
  if (!bridge?.notifyIntrinsicHeight || chatGptHeightObserver) return;
  let scheduled = false;
  const notifyHeight = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      getChatGpt()?.notifyIntrinsicHeight?.(Math.ceil(document.documentElement.scrollHeight));
    });
  };
  chatGptHeightObserver = new ResizeObserver(notifyHeight);
  chatGptHeightObserver.observe(document.documentElement);
  notifyHeight();
}
setupChatGptHeightNotifications();

if (window.parent === window || new URLSearchParams(location.search).has("demo")) {
  void render(sample);
} else {
  app.connect().then(() => {
    const context = app.getHostContext();
    if (context) applyHostContext(context);
  }).catch((error: unknown) => {
    showNotice(error instanceof Error ? error.message : "Could not connect to the host.", true);
  });
}

const audioNavigator = navigator as Navigator & { audioSession?: { type: string } };
if (audioNavigator.audioSession) audioNavigator.audioSession.type = "playback";
