import ABCJS from "abcjs";
import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
  type McpUiStyles,
} from "@modelcontextprotocol/ext-apps";
import {
  instrumentNames,
  renderScoreInputSchema,
  renderScoreOutputSchema,
  type InstrumentName,
  type RenderScoreOutput,
} from "../../shared/score";
import { abcTitle, extractVoiceIds } from "../../shared/voices";
import { applyInstruments } from "./music";
import { TransportController, type TransportState } from "./transport";
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

const app = new App({ name: "ABCoda score", version: "0.2.0" });
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scoreElement = byId<HTMLElement>("score");
const notice = byId<HTMLElement>("notice");
const tempo = byId<HTMLInputElement>("tempo");
const tempoOutput = byId<HTMLOutputElement>("tempo-output");
const playbackButton = byId<HTMLButtonElement>("playback-toggle");
const playbackIcon = byId<HTMLElement>("playback-icon");
const playbackLabel = byId<HTMLElement>("playback-label");
const loopButton = byId<HTMLButtonElement>("loop");

let payload: RenderScoreOutput | undefined;
let visualTune: ABCJS.TuneObject | undefined;
let synth: ABCJS.SynthObjectController | undefined;
let instruments: Record<string, InstrumentName> = {};
let mutedVoices = new Set<string>();
let requestedConfiguration = 0;
let appliedConfiguration = 0;
let configurationRunning = false;

type ChatGptBridge = {
  toolInput?: unknown;
  toolOutput?: unknown;
  theme?: "light" | "dark";
  styles?: { variables?: McpUiStyles; css?: { fonts?: string } };
  notifyIntrinsicHeight?: (height: number) => void;
  requestDisplayMode?: (options: { mode: "inline" | "fullscreen" | "pip" }) => Promise<unknown>;
  openExternal?: (options: { href: string; redirectUrl?: boolean }) => Promise<void>;
};

const getChatGpt = () => (window as Window & { openai?: ChatGptBridge }).openai;

function showNotice(message: string, error = false): void {
  notice.textContent = message;
  notice.hidden = message.length === 0;
  notice.classList.toggle("error", error);
}

function applyHostContext(context: Pick<McpUiHostContext, "theme" | "styles">): void {
  if (context.theme) applyDocumentTheme(context.theme);
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
  if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
}

function updateTransport(state: TransportState): void {
  playbackButton.disabled = !state.ready || state.busy;
  loopButton.disabled = state.busy;
  playbackButton.setAttribute("aria-pressed", String(state.playing));
  playbackButton.setAttribute("aria-label", state.playing ? "Pause" : "Play");
  playbackIcon.textContent = state.playing ? "Ⅱ" : "▶";
  playbackLabel.textContent = state.playing ? "Pause" : "Play";
  loopButton.setAttribute("aria-pressed", String(state.loop));
  tempo.disabled = state.busy;
  tempo.value = String(state.tempo);
  tempoOutput.value = `${state.tempo} BPM`;
  byId<HTMLElement>("app").classList.toggle("is-configuring", state.busy);
}

const transport = new TransportController(96, 96, false, updateTransport);

function clearPlayingCursor(): void {
  scoreElement.querySelectorAll(".abcoda-playing").forEach((node) => node.classList.remove("abcoda-playing"));
}

const cursorControl: ABCJS.CursorControl = {
  onStart: () => transport.playbackStarted(),
  onFinished: () => {
    transport.playbackFinished();
    clearPlayingCursor();
  },
  onEvent: (event) => {
    clearPlayingCursor();
    event.elements?.flat().forEach((element) => element.classList.add("abcoda-playing"));
  },
};

function requestAudioConfiguration(): void {
  requestedConfiguration += 1;
  if (!configurationRunning) void runConfigurationQueue();
}

async function runConfigurationQueue(): Promise<void> {
  configurationRunning = true;
  let completed = false;
  transport.beginConfiguration();
  clearPlayingCursor();

  try {
    if (!ABCJS.synth.supportsAudio()) {
      showNotice("Audio playback is not available in this browser context.", true);
      transport.failConfiguration();
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

    while (appliedConfiguration < requestedConfiguration) {
      const revision = requestedConfiguration;
      const score = payload;
      const tune = visualTune;
      const voiceIds = [...(score?.voiceIds ?? [])];
      const selectedInstruments = { ...instruments };
      const selectedMutes = new Set(mutedVoices);
      if (!score || !tune) break;

      const result = await synth.setTune(tune, false, {
        qpm: score.score.playback.tempo,
        chordsOff: true,
        sequenceCallback: (sequence) =>
          applyInstruments(sequence, voiceIds, selectedInstruments, selectedMutes),
      });
      appliedConfiguration = revision;
      if (result.status === "no-audio-context") showNotice("Tap Play to enable audio.");
    }

    await transport.completeConfiguration(synth);
    completed = true;
  } catch (error) {
    transport.failConfiguration();
    showNotice(error instanceof Error ? error.message : "Audio could not be prepared.", true);
  } finally {
    configurationRunning = false;
    if (completed && appliedConfiguration < requestedConfiguration) void runConfigurationQueue();
  }
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
      requestAudioConfiguration();
    });

    const muteLabel = document.createElement("label");
    muteLabel.className = "mute-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = mutedVoices.has(voiceId);
    checkbox.addEventListener("change", () => {
      checkbox.checked ? mutedVoices.add(voiceId) : mutedVoices.delete(voiceId);
      requestAudioConfiguration();
    });
    muteLabel.append(checkbox, "Mute");
    row.append(name, select, muteLabel);
    container.append(row);
  });
}

async function render(output: RenderScoreOutput): Promise<void> {
  payload = output;
  instruments = { ...output.score.playback.instruments };
  mutedVoices = new Set(output.score.playback.mutedVoices);
  transport.reset(output.score.playback.tempo, output.score.playback.tempo, output.score.playback.loop);
  byId<HTMLElement>("score-title").textContent = output.score.display.title ?? abcTitle(output.score.abc) ?? "Interactive score";
  scoreElement.classList.toggle("colored-voices", output.score.display.coloredVoices);
  showNotice(output.warnings.join(" "));

  const measuresPerLine = output.score.display.preferredMeasuresPerLine ?? (window.innerWidth < 620 ? 2 : 4);
  const tunes = ABCJS.renderAbc(scoreElement, output.score.abc, {
    responsive: "resize",
    add_classes: true,
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
  requestAudioConfiguration();
}

playbackButton.addEventListener("click", () => {
  try { transport.togglePlayback(); } catch { showNotice("Playback could not start.", true); }
});
loopButton.addEventListener("click", () => transport.toggleLoop());
tempo.addEventListener("input", () => void transport.setTempo(Number(tempo.value)));

byId<HTMLButtonElement>("fullscreen").addEventListener("click", async () => {
  try {
    const bridge = getChatGpt();
    if (bridge?.requestDisplayMode) await bridge.requestDisplayMode({ mode: "fullscreen" });
    else await app.requestDisplayMode({ mode: "fullscreen" });
  } catch { /* optional host capability */ }
});

byId<HTMLButtonElement>("sample-credits").addEventListener("click", async () => {
  const href = "https://github.com/gleitz/midi-js-soundfonts";
  try {
    const bridge = getChatGpt();
    if (bridge?.openExternal) await bridge.openExternal({ href, redirectUrl: false });
    else await app.openLink({ url: href });
  } catch { /* optional in standalone and restricted hosts */ }
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
  applyHostContext(globals);
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
