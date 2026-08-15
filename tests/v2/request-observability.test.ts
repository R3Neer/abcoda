import { describe, expect, it } from "vitest";
import {
  startMcpToolObservation,
  type McpToolObservation,
} from "../../apps/worker/src/mcp/request-observability";

function clock(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)]!;
}

describe("request-scoped MCP observability", () => {
  it("correlates a completed tool result without copying its payload into the event", () => {
    const observations: McpToolObservation[] = [];
    const sensitiveMarker = "X:PRIVATE-MUSIC-MARKER";
    const observation = startMcpToolObservation(
      {
        requestId: "request-123",
        emit: (event) => observations.push(event),
        now: clock(100, 125),
      },
      "validate_score",
    );

    const result = observation.complete("success", {
      structuredContent: { source: sensitiveMarker },
      content: [{ type: "text" as const, text: sensitiveMarker }],
    });

    expect(result._meta).toEqual({ "abcoda/requestId": "request-123" });
    expect(observations).toEqual([{
      event: "mcp.tool.completed",
      requestId: "request-123",
      toolName: "validate_score",
      outcome: "success",
      durationMs: 25,
    }]);
    expect(JSON.stringify(observations)).not.toContain(sensitiveMarker);
  });

  it("emits one failed event and still correlates the mapped error result", () => {
    const observations: McpToolObservation[] = [];
    const observation = startMcpToolObservation(
      {
        requestId: "request-failed",
        emit: (event) => observations.push(event),
        now: clock(8, 13),
      },
      "prepare_composition",
    );

    const result = observation.complete("failure", {
      isError: true,
      content: [{ type: "text" as const, text: "private input-derived detail" }],
    }, true);

    expect(result._meta).toEqual({ "abcoda/requestId": "request-failed" });
    expect(observations).toEqual([{
      event: "mcp.tool.failed",
      requestId: "request-failed",
      toolName: "prepare_composition",
      outcome: "failure",
      durationMs: 5,
    }]);
    expect(JSON.stringify(observations)).not.toContain("private input-derived detail");
  });
});
