import { describe, expect, it, vi } from "vitest";
import {
  ScoreSessionController,
  type Engraver,
} from "../../apps/widget/src/application/score-session";

const successfulScore = {
  status: "success" as const,
  snapshot: {
    schemaVersion: 2 as const,
    revision: 1,
    document: {
      tuneId: "resize-test",
      tempo: {
        beatUnit: "quarter" as const,
        bpm: 84,
      },
      voices: [
        {
          id: "P1",
          kind: "pitched" as const,
        },
      ],
      source: {
        format: "abc" as const,
        text: "X:1\nK:C\nC4|]\n",
      },
    },
    diagnostics: [],
  },
};

describe("ScoreSessionController reflow", () => {
  it("requests a visual-only engraving during resize reflow", async () => {
    const render = vi.fn().mockResolvedValue({
      timeline: {
        events: [],
        totalDurationMs: 1000,
      },
    });

    const engraver: Engraver = {
      render,
      clear: vi.fn(),
    };

    const onEngraved = vi.fn();

    const session = new ScoreSessionController(
      engraver,
      vi.fn(),
      onEngraved,
    );

    await session.receive(successfulScore);
    await session.reflow();

    expect(render).toHaveBeenCalledTimes(2);
    expect(render.mock.calls[1]?.[3]).toEqual({
      includePlayback: false,
    });

    expect(onEngraved.mock.calls[0]?.[3]).toBe("content");
    expect(onEngraved.mock.calls[1]?.[3]).toBe("reflow");
  });
});