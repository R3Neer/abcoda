import type {
  HostBridge,
  HostBridgeHandlers,
} from "../../application/host-bridge";

const laboratoryResult = {
  status: "success",
  snapshot: {
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
  },
} as const;

export class StandaloneHostBridge implements HostBridge {
  connect(handlers: HostBridgeHandlers): Promise<void> {
    handlers.onResult(laboratoryResult);
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }
}
