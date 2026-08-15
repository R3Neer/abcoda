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
import { abcGlobalKey, inferVoiceKind, setVoiceKind, transposeAbc, type VoiceKind } from "../../shared/abc-edit";
import {
  eventProgress,
  cursorMotionFrom,
  cursorPlaybackActive,
  firstEventInMeasure,
  matchingCursorEvent,
  measureAtPoint,
  timingEventsForTune,
  totalMeasureFromClasses,
  visibleTimingEvents,
  type VisibleTimingEvent,
} from "./cursor";
import { DeferredAudioBackend, type SynthControllerLike } from "./deferred-audio";
import {
  applyInstruments,
  instrumentForVoiceKind,
  instrumentFromLabel,
  instrumentLabel,
  pitchesByVoice,
  playbackTuneForInstruments,
  rangeFit,
  voiceKindForInstrument,
} from "./music";
import { decodeStandaloneScore, encodeStandaloneScore } from "./standalone";
import { hiddenSynthVisualOptions } from "./synth-options";
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
    notation: { voiceKinds: {} },
    display: { title: "ABCoda demo", coloredVoices: false },
  },
};

const app = new App({ name: "ABCoda score", version: "0.5.0" });
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scoreElement = byId<HTMLElement>("score");
const notice = byId<HTMLElement>("notice");
const noticeMessage = byId<HTMLElement>("notice-message");
const tempo = byId<HTMLInputElement>("tempo");
const tempoOutput = byId<HTMLOutputElement>("tempo-output");
const playbackButton = byId<HTMLButtonElement>("playback-toggle");
const playbackIcon = byId<HTMLElement>("playback-icon");
const playbackLabel = byId<HTMLElement>("playback-label");
const rewindButton = byId<HTMLButtonElement>("rewind");
const loopButton = byId<HTMLButtonElement>("loop");
const mixer = byId<HTMLDetailsElement>("mixer");
const codeToggle = byId<HTMLButtonElement>("code-toggle");
const abcPanel = byId<HTMLElement>("abc-panel");
const abcSource = byId<HTMLTextAreaElement>("abc-source");
const transposeDown = byId<HTMLButtonElement>("transpose-down");
const transposeUp = byId<HTMLButtonElement>("transpose-up");
const transposeReset = byId<HTMLButtonElement>("transpose-reset");
const transposeOutput = byId<HTMLOutputElement>("transpose-output");
const fullscreenButton = byId<HTMLButtonElement>("fullscreen");
const instrumentOptions = byId<HTMLDataListElement>("instrument-options");

let payload: RenderScoreOutput | undefined;
let visualTune: ABCJS.TuneObject | undefined;
let synth: ABCJS.SynthObjectController | undefined;
let playbackBackend: DeferredAudioBackend | undefined;
let instruments: Record<string, InstrumentName> = {};
let mutedVoices = new Set<string>();
let requestedConfiguration = 0;
let appliedConfiguration = 0;
let configurationRunning = false;
let sourceAbc = "";
let initialAbc = "";
let transposeOffset = 0;
let codeView = false;
let pitchedKeys: Record<string, string> = {};
let voicePitches: Record<string, number[]> = {};

instrumentOptions.replaceChildren(...instrumentNames.map((instrument) => {
  const option = document.createElement("option");
  option.value = instrumentLabel(instrument);
  return option;
}));

class ScoreCursor {
  private line: SVGLineElement | undefined;
  private events: VisibleTimingEvent[] = [];
  private current: VisibleTimingEvent | undefined;
  private frame = 0;
  private playing = false;
  private x = 0;

  setEvents(events: VisibleTimingEvent[]): void {
    const previousProgress = this.current && this.events.length > 0
      ? eventProgress(this.current, this.events)
      : 0;
    this.events = events;
    this.ensureLine();
    this.current = events.find((event) => eventProgress(event, events) >= previousProgress) ?? events[0];
    if (this.current) this.place(this.current.left, this.current);
  }

  setPlaying(playing: boolean): void {
    if (this.playing === playing) return;
    this.playing = playing;
    if (!playing) cancelAnimationFrame(this.frame);
    else if (this.current) this.animateFrom(this.current);
  }

  onEvent(event: ABCJS.NoteTimingEvent): void {
    const current = matchingCursorEvent(this.events, event);
    if (!current) return;
    this.line?.classList.remove("is-wrapping");
    this.current = current;
    this.place(current.left, current);
    if (this.playing) this.animateFrom(current);
  }

  seek(event: VisibleTimingEvent): void {
    cancelAnimationFrame(this.frame);
    this.line?.classList.remove("is-wrapping");
    this.current = event;
    this.place(event.left, event);
    if (this.playing) this.animateFrom(event);
  }

  rewind(): void {
    const first = this.events[0];
    if (first) this.seek(first);
  }

  private ensureLine(): void {
    const svg = scoreElement.querySelector("svg");
    if (!svg) return;
    if (this.line?.ownerSVGElement === svg) return;
    this.line?.remove();
    this.line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    this.line.classList.add("abcoda-cursor");
    this.line.setAttribute("aria-hidden", "true");
    svg.append(this.line);
  }

  private place(x: number, event: VisibleTimingEvent): void {
    this.ensureLine();
    this.x = x;
    this.line?.setAttribute("x1", String(x));
    this.line?.setAttribute("x2", String(x));
    this.line?.setAttribute("y1", String(event.top - 2));
    this.line?.setAttribute("y2", String(event.top + event.height + 2));
    this.line?.classList.add("is-visible");
  }

  private animateFrom(current: VisibleTimingEvent): void {
    cancelAnimationFrame(this.frame);
    const motion = cursorMotionFrom(this.events, current);
    if (!motion) return;
    const fullDistance = motion.x - current.left;
    const remainingDistance = motion.x - this.x;
    if (fullDistance <= 0 || remainingDistance <= 0) return;
    const duration = motion.duration * (remainingDistance / fullDistance);
    const startX = this.x;
    const started = performance.now();
    const tick = (now: number) => {
      if (!this.playing || this.current !== current) return;
      const progress = Math.min(1, (now - started) / Math.max(1, duration));
      this.place(startX + remainingDistance * progress, current);
      if (motion.wrapsLine && progress > 0.82) this.line?.classList.add("is-wrapping");
      if (progress < 1) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
}

const scoreCursor = new ScoreCursor();

type ChatGptBridge = {
  toolInput?: unknown;
  toolOutput?: unknown;
  theme?: "light" | "dark";
  styles?: { variables?: McpUiStyles; css?: { fonts?: string } };
  displayMode?: "inline" | "fullscreen" | "pip";
  maxHeight?: number;
  safeArea?: { top?: number; right?: number; bottom?: number; left?: number };
  notifyIntrinsicHeight?: (height: number) => void;
  requestDisplayMode?: (options: { mode: "inline" | "fullscreen" | "pip" }) => Promise<unknown>;
  openExternal?: (options: { href: string; redirectUrl?: boolean }) => Promise<void>;
  setOpenInAppUrl?: (options: { href: string }) => void;
};

const getChatGpt = () => (window as Window & { openai?: ChatGptBridge }).openai;

function showNotice(message: string, error = false): void {
  noticeMessage.textContent = message;
  notice.hidden = message.length === 0;
  notice.classList.toggle("error", error);
}

byId<HTMLButtonElement>("notice-dismiss").addEventListener("click", () => showNotice(""));

type HostVisualContext = Pick<
  McpUiHostContext,
  "theme" | "styles" | "displayMode" | "containerDimensions" | "safeAreaInsets"
> & Pick<ChatGptBridge, "maxHeight" | "safeArea">;

function applyHostContext(context: HostVisualContext): void {
  if (context.theme) applyDocumentTheme(context.theme);
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
  if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
  if (context.displayMode) {
    document.documentElement.dataset.displayMode = context.displayMode;
    fullscreenButton.hidden = context.displayMode === "fullscreen";
  }

  const dimensions = context.containerDimensions;
  const height = dimensions && "height" in dimensions
    ? dimensions.height
    : dimensions?.maxHeight ?? context.maxHeight;
  if (height) document.documentElement.style.setProperty("--abcoda-host-height", `${height}px`);

  const safeArea = context.safeAreaInsets ?? context.safeArea;
  if (safeArea) {
    document.documentElement.style.setProperty("--abcoda-safe-top", `${safeArea.top ?? 0}px`);
    document.documentElement.style.setProperty("--abcoda-safe-right", `${safeArea.right ?? 0}px`);
    document.documentElement.style.setProperty("--abcoda-safe-bottom", `${safeArea.bottom ?? 0}px`);
    document.documentElement.style.setProperty("--abcoda-safe-left", `${safeArea.left ?? 0}px`);
  }
}

function updateOpenInAppUrl(output: RenderScoreOutput): void {
  const bridge = getChatGpt();
  if (!bridge?.setOpenInAppUrl) return;
  const hash = encodeStandaloneScore(output);
  const base = "https://abcoda.mud-repo-patcher-mcp-probe.workers.dev/";
  bridge.setOpenInAppUrl({ href: hash.length <= 24_000 ? `${base}${hash}` : `${base}?demo=1` });
}

function updateTransport(state: TransportState): void {
  const starting = state.busy && state.playing;
  playbackButton.disabled = !state.ready || state.busy;
  rewindButton.disabled = !state.ready || state.busy;
  loopButton.disabled = state.busy;
  transposeDown.disabled = state.busy || transposeOffset <= -12;
  transposeUp.disabled = state.busy || transposeOffset >= 12;
  transposeReset.disabled = state.busy || transposeOffset === 0;
  playbackButton.setAttribute("aria-pressed", String(state.playing));
  playbackButton.setAttribute("aria-label", starting ? "Preparing audio" : state.playing ? "Pause" : "Play");
  playbackButton.setAttribute("aria-busy", String(starting));
  playbackIcon.dataset.state = starting ? "loading" : state.playing ? "pause" : "play";
  playbackLabel.textContent = starting ? "Loading…" : state.playing ? "Pause" : "Play";
  loopButton.setAttribute("aria-pressed", String(state.loop));
  tempo.disabled = state.busy;
  tempo.value = String(state.tempo);
  tempoOutput.value = `${state.tempo} BPM`;
  byId<HTMLElement>("app").classList.toggle("is-configuring", state.busy);
  scoreElement.classList.toggle("is-seekable", state.ready && !state.busy);
  // The transport marks an awaited first play as optimistic `playing` while
  // abcjs is still constructing/resuming audio. Start visual time only after
  // that work has completed so the cursor cannot run ahead of the sound.
  scoreCursor.setPlaying(cursorPlaybackActive(state));
}

const transport = new TransportController(96, 96, false, updateTransport);

function refreshCursorEvents(): void {
  if (!visualTune) return;
  try {
    scoreCursor.setEvents(visibleTimingEvents(timingEventsForTune(visualTune, transport.snapshot().tempo)));
  } catch {
    // Cursor timing is an enhancement. It must never disable score playback.
    scoreCursor.setEvents([]);
  }
}

const cursorControl: ABCJS.CursorControl = {
  onStart: () => {
    if (noticeMessage.textContent === "Tap Play to enable audio.") showNotice("");
    transport.playbackStarted();
  },
  onFinished: () => {
    transport.playbackFinished();
    scoreCursor.rewind();
  },
  onEvent: (event) => scoreCursor.onEvent(event),
};

function requestAudioConfiguration(): void {
  requestedConfiguration += 1;
  if (!configurationRunning) void runConfigurationQueue();
}

async function runConfigurationQueue(): Promise<void> {
  configurationRunning = true;
  let completed = false;
  transport.beginConfiguration();

  try {
    if (!ABCJS.synth.supportsAudio()) {
      showNotice("Audio playback is not available in this browser context.", true);
      transport.failConfiguration();
      return;
    }

    synth ??= new ABCJS.synth.SynthController();
    playbackBackend ??= new DeferredAudioBackend(
      synth as unknown as SynthControllerLike,
      async () => {
        const context = ABCJS.synth.activeAudioContext();
        if (context.state !== "running") await context.resume();
        if (context.state !== "running") {
          throw new Error("Audio is blocked by the browser. Check that this tab is not muted, then press Play again.");
        }
      },
    );
    synth.load("#abcjs-audio", cursorControl, hiddenSynthVisualOptions);

    while (appliedConfiguration < requestedConfiguration) {
      const revision = requestedConfiguration;
      const score = payload;
      const tune = visualTune;
      const voiceIds = [...(score?.voiceIds ?? [])];
      const selectedInstruments = { ...instruments };
      const selectedMutes = new Set(mutedVoices);
      if (!score || !tune) break;

      await playbackBackend.configure(playbackTuneForInstruments(tune, voiceIds, selectedInstruments), {
        qpm: score.score.playback.tempo,
        midiTranspose: 0,
        soundFontVolumeMultiplier: 3,
        chordsOff: true,
        sequenceCallback: (sequence) =>
          applyInstruments(sequence, voiceIds, selectedInstruments, selectedMutes),
      });
      appliedConfiguration = revision;
      if (notice.hidden || noticeMessage.textContent === "Tap Play to enable audio.") {
        showNotice("Tap Play to enable audio.");
      }
    }

    await transport.completeConfiguration(playbackBackend);
    completed = true;
    refreshCursorEvents();
  } catch (error) {
    transport.failConfiguration();
    showNotice(error instanceof Error ? error.message : "Audio could not be prepared.", true);
  } finally {
    configurationRunning = false;
    if (completed && appliedConfiguration < requestedConfiguration) void runConfigurationQueue();
  }
}

function outputWithAbc(abc: string, warnings: string[] = []): RenderScoreOutput | undefined {
  if (!payload) return undefined;
  return {
    ...payload,
    voiceIds: extractVoiceIds(abc),
    warnings,
    score: {
      ...payload.score,
      abc,
      notation: { voiceKinds: { ...payload.score.notation.voiceKinds } },
      playback: {
        ...payload.score.playback,
        instruments: { ...instruments },
        mutedVoices: [...mutedVoices],
      },
    },
  };
}

function commitAbcEdit(abc: string, message?: string): void {
  sourceAbc = abc;
  transposeOffset = 0;
  updateTransposeOutput();
  const next = outputWithAbc(abc, message ? [message] : []);
  if (next) void render(next, { preserveEditState: true });
}

function voiceKindFor(voiceId: string): VoiceKind {
  return payload?.score.notation.voiceKinds[voiceId]
    ?? inferVoiceKind(payload?.score.abc ?? "", voiceId);
}

function changeVoiceKind(voiceId: string, kind: VoiceKind): void {
  if (!payload) return;
  if (voiceKindFor(voiceId) === "pitched") pitchedKeys[voiceId] = abcGlobalKey(payload.score.abc);
  payload.score.notation.voiceKinds[voiceId] = kind;
  instruments[voiceId] = instrumentForVoiceKind(
    kind,
    instruments[voiceId] ?? "acoustic_grand_piano",
  );
  const abc = setVoiceKind(payload.score.abc, voiceId, kind, pitchedKeys[voiceId]);
  commitAbcEdit(abc);
}

function applyInstrumentRangeState(input: HTMLInputElement, voiceId: string, instrument: InstrumentName): void {
  const result = rangeFit(voicePitches[voiceId] ?? [], instrument);
  input.dataset.rangeFit = result.fit;
  input.removeAttribute("aria-invalid");
  if (result.fit === "outside") input.setAttribute("aria-invalid", "true");
  input.title = result.fit === "partial"
    ? `${result.outside} distinct pitch${result.outside === 1 ? " is" : "es are"} outside the typical ${instrumentLabel(instrument)} range (${result.range.label}).`
    : result.fit === "outside"
      ? `No score pitches fall inside the typical ${instrumentLabel(instrument)} range (${result.range.label}).`
      : `Typical range: ${result.range.label}.`;
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

    const kindSelect = document.createElement("select");
    kindSelect.className = "notation-select";
    kindSelect.setAttribute("aria-label", `Notation type for ${voiceId}`);
    const currentKind = voiceKindFor(voiceId);
    (["pitched", "unpitched_percussion"] as const).forEach((kind) => {
      const option = document.createElement("option");
      option.value = kind;
      option.textContent = kind === "pitched" ? "Pitched notation" : "Percussion notation";
      option.selected = currentKind === kind;
      kindSelect.append(option);
    });
    kindSelect.addEventListener("change", () => changeVoiceKind(voiceId, kindSelect.value as VoiceKind));

    const instrumentInput = document.createElement("input");
    instrumentInput.type = "text";
    instrumentInput.className = "instrument-combobox";
    instrumentInput.setAttribute("list", "instrument-options");
    instrumentInput.setAttribute("role", "combobox");
    instrumentInput.setAttribute("aria-autocomplete", "list");
    instrumentInput.setAttribute("aria-label", `Instrument for ${voiceId}`);
    const currentInstrument = instruments[voiceId] ?? "acoustic_grand_piano";
    instrumentInput.value = instrumentLabel(currentInstrument);
    applyInstrumentRangeState(instrumentInput, voiceId, currentInstrument);
    instrumentInput.addEventListener("input", () => instrumentInput.setCustomValidity(""));
    instrumentInput.addEventListener("change", () => {
      const selected = instrumentFromLabel(instrumentInput.value);
      if (!selected) {
        instrumentInput.setCustomValidity("Choose an instrument from the list.");
        instrumentInput.reportValidity();
        instrumentInput.value = instrumentLabel(instruments[voiceId] ?? "acoustic_grand_piano");
        return;
      }
      instrumentInput.value = instrumentLabel(selected);
      instruments[voiceId] = selected;
      applyInstrumentRangeState(instrumentInput, voiceId, selected);
      const requiredKind = voiceKindForInstrument(selected);
      if (voiceKindFor(voiceId) !== requiredKind) {
        changeVoiceKind(voiceId, requiredKind);
        return;
      }
      if (payload) payload.score.playback.instruments = { ...instruments };
      requestAudioConfiguration();
    });

    const muteLabel = document.createElement("label");
    muteLabel.className = "mute-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = mutedVoices.has(voiceId);
    checkbox.addEventListener("change", () => {
      checkbox.checked ? mutedVoices.add(voiceId) : mutedVoices.delete(voiceId);
      if (payload) payload.score.playback.mutedVoices = [...mutedVoices];
      requestAudioConfiguration();
    });
    muteLabel.append(checkbox, "Mute");
    row.append(name, kindSelect, instrumentInput, muteLabel);
    container.append(row);
  });
}

async function render(
  output: RenderScoreOutput,
  options: { preserveEditState?: boolean } = {},
): Promise<void> {
  payload = output;
  if (!options.preserveEditState) {
    sourceAbc = output.score.abc;
    initialAbc = output.score.abc;
    transposeOffset = 0;
    pitchedKeys = Object.fromEntries(
      output.voiceIds
        .filter((voiceId) => (output.score.notation.voiceKinds[voiceId] ?? inferVoiceKind(output.score.abc, voiceId)) === "pitched")
        .map((voiceId) => [voiceId, abcGlobalKey(output.score.abc)]),
    );
    updateTransposeOutput();
  }
  abcSource.value = output.score.abc;
  playbackBackend = undefined;
  updateOpenInAppUrl(output);
  instruments = { ...output.score.playback.instruments };
  mutedVoices = new Set(output.score.playback.mutedVoices);
  transport.reset(output.score.playback.tempo, output.score.playback.tempo, output.score.playback.loop);
  byId<HTMLElement>("score-title").textContent = output.score.display.title ?? abcTitle(output.score.abc) ?? "Interactive score";
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
  try {
    voicePitches = pitchesByVoice(visualTune, output.voiceIds, output.score.playback.tempo);
  } catch {
    voicePitches = {};
  }
  renderMixer();
  requestAudioConfiguration();
}

playbackButton.addEventListener("click", () => {
  void transport.togglePlayback().catch(() => showNotice("Playback could not start.", true));
});
loopButton.addEventListener("click", () => transport.toggleLoop());
rewindButton.addEventListener("click", () => {
  transport.rewind();
  scoreCursor.rewind();
});
tempo.addEventListener("input", () => {
  // Preview the value immediately, but don't ask abcjs to rebuild its entire
  // audio buffer for every pixel traversed by the range control.
  tempoOutput.value = `${tempo.value} BPM`;
});
tempo.addEventListener("change", () => {
  void transport.setTempo(Number(tempo.value))
    .then(refreshCursorEvents)
    .catch((error: unknown) => showNotice(
      error instanceof Error ? error.message : "Tempo could not be changed.",
      true,
    ));
});

function updateTransposeOutput(): void {
  transposeOutput.value = transposeOffset === 0
    ? "Original"
    : `${transposeOffset > 0 ? "+" : ""}${transposeOffset} st`;
  const busy = transport.snapshot().busy;
  transposeDown.disabled = busy || transposeOffset <= -12;
  transposeUp.disabled = busy || transposeOffset >= 12;
  transposeReset.disabled = busy || transposeOffset === 0;
}

function setTransposition(nextOffset: number): void {
  if (!payload || transport.snapshot().busy) return;
  try {
    const bounded = Math.max(-12, Math.min(12, nextOffset));
    const abc = transposeAbc(sourceAbc, bounded);
    transposeOffset = bounded;
    updateTransposeOutput();
    const next = outputWithAbc(abc);
    if (next) void render(next, { preserveEditState: true });
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "The score could not be transposed.", true);
  }
}

transposeDown.addEventListener("click", () => setTransposition(transposeOffset - 1));
transposeUp.addEventListener("click", () => setTransposition(transposeOffset + 1));
transposeReset.addEventListener("click", () => setTransposition(0));

function setCodeView(enabled: boolean): void {
  codeView = enabled;
  byId<HTMLElement>("app").classList.toggle("is-code-view", enabled);
  abcPanel.hidden = !enabled;
  codeToggle.setAttribute("aria-pressed", String(enabled));
  codeToggle.setAttribute("aria-label", enabled ? "View score" : "View ABC code");
  codeToggle.title = enabled ? "View score" : "View ABC code";
  if (enabled) {
    abcSource.value = payload?.score.abc ?? sourceAbc;
    requestAnimationFrame(() => abcSource.focus());
  } else if (payload) {
    void render(payload, { preserveEditState: true });
  }
}

codeToggle.addEventListener("click", () => setCodeView(!codeView));

byId<HTMLButtonElement>("abc-apply").addEventListener("click", () => {
  const abc = abcSource.value.trim();
  try {
    const tunes = ABCJS.parseOnly(abc);
    if (!(tunes[0] as ABCJS.TuneObject | undefined)) throw new Error("No ABC tune was found.");
    const warnings = tunes.flatMap((tune) => tune.warnings ?? []).map(String);
    sourceAbc = abc;
    transposeOffset = 0;
    for (const voiceId of extractVoiceIds(abc)) {
      if (inferVoiceKind(abc, voiceId) === "pitched") pitchedKeys[voiceId] = abcGlobalKey(abc);
    }
    updateTransposeOutput();
    const next = outputWithAbc(abc, warnings.length ? warnings : ["ABC changes applied."]);
    if (next) void render(next, { preserveEditState: true });
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "The edited ABC could not be parsed.", true);
  }
});

byId<HTMLButtonElement>("abc-reset").addEventListener("click", () => {
  if (!initialAbc) return;
  sourceAbc = initialAbc;
  transposeOffset = 0;
  updateTransposeOutput();
  const next = outputWithAbc(initialAbc, ["The original ABC was restored."]);
  if (next) void render(next, { preserveEditState: true });
});

byId<HTMLButtonElement>("abc-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(abcSource.value);
    showNotice("ABC copied.");
  } catch {
    abcSource.focus();
    abcSource.select();
    const copied = document.execCommand("copy");
    showNotice(copied ? "ABC copied." : "Select the ABC and copy it manually.", !copied);
  }
});

function seekToMeasure(measureNumber: number): void {
  let timings = (visualTune as ABCJS.TuneObject & { noteTimings?: ABCJS.NoteTimingEvent[] } | undefined)?.noteTimings ?? [];
  let cursorEvents = visibleTimingEvents(timings);
  if (cursorEvents.length === 0) {
    if (!visualTune) return;
    try {
      timings = timingEventsForTune(visualTune, transport.snapshot().tempo);
    } catch {
      return;
    }
    cursorEvents = visibleTimingEvents(timings);
  }
  const target = firstEventInMeasure(cursorEvents, measureNumber);
  if (!target) return;
  transport.seek(eventProgress(target, cursorEvents, timings.at(-1)?.milliseconds));
  scoreCursor.seek(target);
}

scoreElement.addEventListener("click", (event) => {
  if (!transport.snapshot().ready) return;
  const target = event.target as Element;
  const classNames = target.closest("[class*='abcjs-m']")?.getAttribute("class") ?? "";
  const classMeasure = totalMeasureFromClasses(classNames, -1);
  if (classMeasure >= 0) {
    seekToMeasure(classMeasure);
    return;
  }

  const svg = target.closest("svg") as SVGSVGElement | null;
  if (!svg || !visualTune) return;
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const x = viewBox.x + ((event.clientX - rect.left) / rect.width) * viewBox.width;
  const y = viewBox.y + ((event.clientY - rect.top) / rect.height) * viewBox.height;
  const timings = visibleTimingEvents((visualTune as ABCJS.TuneObject & { noteTimings?: ABCJS.NoteTimingEvent[] }).noteTimings ?? []);
  const pointMeasure = measureAtPoint(timings, x, y);
  if (pointMeasure !== undefined) seekToMeasure(pointMeasure);
});

mixer.addEventListener("toggle", () => {
  if (!mixer.open || document.documentElement.dataset.displayMode !== "fullscreen") return;
  requestAnimationFrame(() => mixer.scrollIntoView({ block: "nearest", behavior: "smooth" }));
});

fullscreenButton.addEventListener("click", async () => {
  try {
    const bridge = getChatGpt();
    if (bridge?.requestDisplayMode) await bridge.requestDisplayMode({ mode: "fullscreen" });
    else await app.requestDisplayMode({ mode: "fullscreen" });
    document.documentElement.dataset.displayMode = "fullscreen";
    fullscreenButton.hidden = true;
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
  document.documentElement.dataset.displayMode = "standalone";
  void render(decodeStandaloneScore(location.hash) ?? sample);
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
