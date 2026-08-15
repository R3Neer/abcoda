export type McpToolName =
  | "prepare_composition"
  | "validate_score"
  | "render_score";

export type McpToolOutcome =
  | "success"
  | "invalid"
  | "unsupported"
  | "failure";

export interface McpToolObservation {
  readonly event: "mcp.tool.completed" | "mcp.tool.failed";
  readonly requestId: string;
  readonly toolName: McpToolName;
  readonly outcome: McpToolOutcome;
  readonly durationMs: number;
}

export interface McpRequestObservability {
  readonly requestId: string;
  readonly emit: (observation: McpToolObservation) => void;
  readonly now?: () => number;
}

interface MetaCapableResult {
  readonly _meta?: Record<string, unknown>;
}

export interface ObservedToolExecution<Result extends MetaCapableResult> {
  readonly result: Result;
  readonly outcome: McpToolOutcome;
  readonly failed?: boolean;
}

export function observeMcpTool<Result extends MetaCapableResult>(
  observability: McpRequestObservability | undefined,
  toolName: McpToolName,
  execute: () => ObservedToolExecution<Result>,
): Result {
  const now = observability?.now ?? Date.now;
  const startedAt = now();
  const execution = execute();
  const durationMs = Math.max(0, now() - startedAt);

  if (observability) {
    observability.emit({
      event: execution.failed ? "mcp.tool.failed" : "mcp.tool.completed",
      requestId: observability.requestId,
      toolName,
      outcome: execution.outcome,
      durationMs,
    });

    return {
      ...execution.result,
      _meta: {
        ...execution.result._meta,
        "abcoda/requestId": observability.requestId,
      },
    };
  }

  return execution.result;
}
