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

export interface ObservedToolExecution<Result extends object> {
  readonly result: Result;
  readonly outcome: McpToolOutcome;
  readonly failed?: boolean;
}

function resultMeta(result: object): Record<string, unknown> {
  if (!("_meta" in result)) return {};
  const meta = (result as { readonly _meta?: unknown })._meta;
  return typeof meta === "object" && meta !== null
    ? meta as Record<string, unknown>
    : {};
}

export function observeMcpTool<Result extends object>(
  observability: McpRequestObservability | undefined,
  toolName: McpToolName,
  execute: () => ObservedToolExecution<Result>,
): Result & { readonly _meta?: Record<string, unknown> } {
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
        ...resultMeta(execution.result),
        "abcoda/requestId": observability.requestId,
      },
    };
  }

  return execution.result;
}
