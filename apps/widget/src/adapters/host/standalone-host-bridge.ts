import type {
  HostBridge,
  HostBridgeHandlers,
  HostPresentationContext,
} from "../../application/host-bridge";

export type LaboratoryScenario = "ready" | "invalid" | "malformed" | "race" | "invalid-after-ready";

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
V:RH clef=treble
V:LH clef=bass
%%score { RH LH }
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
