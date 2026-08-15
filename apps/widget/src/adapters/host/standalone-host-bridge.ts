import type {
  HostBridge,
  HostBridgeHandlers,
  HostPresentationContext,
} from "../../application/host-bridge";

export type LaboratoryScenario = "ready" | "legacy" | "mixed" | "ranges" | "invalid" | "malformed" | "race" | "invalid-after-ready";

const laboratoryResult = {
  status: "success",
  snapshot: {
    schemaVersion: 2,
    revision: 1,
    document: {
      tuneId: "laboratory-1",
      title: "First architecture v2 vertical",
      meter: "4/4",
      key: "C",
      tempo: { beatUnit: "quarter", bpm: 84 },
      voices: [
        { id: "RH", kind: "pitched" },
        { id: "LH", kind: "pitched" },
      ],
      source: {
        format: "abc",
        text: `X:1
T:First architecture v2 vertical
M:4/4
L:1/4
Q:1/4=84
%%score { RH | LH }
V:RH clef=treble
V:LH clef=bass
K:C
[V:RH] C D E F|G A B c|]
[V:LH] C, D, E, F,|G, A, B, C|]`,
      },
    },
    diagnostics: [],
  },
} as const;

const invalidResult = {
  status: "invalid",
  diagnostics: [{
    code: "ABC_MULTIPLE_TUNES_UNSUPPORTED",
    severity: "error",
    message: "ABCoda v2 accepts exactly one complete tune per request.",
  }],
} as const;

const legacyResult = {
  ...laboratoryResult,
  presentation: {
    tempo: 112,
    instruments: { RH: "cello" },
    mutedVoices: ["LH"],
    loop: true,
    title: "Legacy presentation",
    preferredMeasuresPerLine: 3,
  },
} as const;

const mixedResult = {
  status: "success",
  snapshot: {
    schemaVersion: 2,
    revision: 1,
    document: {
      tuneId: "laboratory-mixed",
      title: "Melody and percussion",
      meter: "4/4",
      key: "C",
      tempo: { beatUnit: "quarter", bpm: 96 },
      voices: [
        { id: "P", kind: "pitched" },
        { id: "D", kind: "unpitched_percussion" },
      ],
      source: {
        format: "abc",
        text: `X:1
T:Melody and percussion
M:4/4
L:1/4
Q:1/4=96
%%score P D
V:P clef=treble
V:D clef=perc
K:C
[V:P] C D E F|G A B c|]
[V:D][K:none clef=perc] C D E F|C D E F|]`,
      },
    },
    diagnostics: [],
  },
} as const;

const rangeResult = {
  status: "success",
  snapshot: {
    schemaVersion: 2,
    revision: 1,
    document: {
      tuneId: "laboratory-ranges",
      title: "Instrument range states",
      meter: "4/4",
      key: "C",
      tempo: { beatUnit: "quarter", bpm: 96 },
      voices: [
        { id: "USUAL", kind: "pitched" },
        { id: "EXTENDED", kind: "pitched" },
        { id: "UNPLAYABLE", kind: "pitched" },
      ],
      source: {
        format: "abc",
        text: `X:1
T:Instrument range states
M:4/4
L:1/4
Q:1/4=96
%%score USUAL EXTENDED UNPLAYABLE
V:USUAL clef=treble
V:EXTENDED clef=treble
V:UNPLAYABLE clef=treble
K:C
[V:USUAL] G A B c|]
[V:EXTENDED] d' d' c' d'|]
[V:UNPLAYABLE] e' f' e' f'|]`,
      },
    },
    diagnostics: [],
  },
  presentation: {
    tempo: 96,
    instruments: {
      USUAL: "trumpet",
      EXTENDED: "trumpet",
      UNPLAYABLE: "trumpet",
    },
    mutedVoices: [],
    loop: false,
    title: "Instrument range states",
  },
} as const;

export class StandaloneHostBridge implements HostBridge {
  private readonly timers = new Set<number>();

  constructor(
    private readonly scenario: LaboratoryScenario = "ready",
    private readonly context: HostPresentationContext = {},
  ) {}

  connect(handlers: HostBridgeHandlers): Promise<void> {
    handlers.onContext(this.context);
    if (this.scenario === "invalid") {
      handlers.onResult(invalidResult);
    } else if (this.scenario === "legacy") {
      handlers.onResult(legacyResult);
    } else if (this.scenario === "mixed") {
      handlers.onResult(mixedResult);
    } else if (this.scenario === "ranges") {
      handlers.onResult(rangeResult);
    } else if (this.scenario === "invalid-after-ready") {
      handlers.onResult(laboratoryResult);
      this.schedule(() => handlers.onResult(invalidResult), 80);
    } else if (this.scenario === "malformed") {
      handlers.onResult({ status: "success", snapshot: null });
    } else if (this.scenario === "race") {
      this.schedule(() => handlers.onResult({
        ...laboratoryResult,
        snapshot: { ...laboratoryResult.snapshot, revision: 3 },
      }), 10);
      this.schedule(() => handlers.onResult({
        ...laboratoryResult,
        snapshot: { ...laboratoryResult.snapshot, revision: 2 },
      }), 40);
    } else {
      handlers.onResult(laboratoryResult);
    }
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    return Promise.resolve();
  }

  private schedule(action: () => void, delay: number): void {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      action();
    }, delay);
    this.timers.add(timer);
  }
}
