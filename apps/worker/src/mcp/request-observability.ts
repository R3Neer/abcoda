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

export interface McpToolObservationScope {
  complete<Result extends object>(
    outcome: McpToolOutcome,
    result: Result,
    failed?: boolean,
  ): Result & { readonly _meta?: Record<string, unknown> };
}

function resultMeta(result: object): Record<string, unknown> {
  if (!("_meta" in result)) return {};
  const meta = (result as { readonly _meta?: unknown })._meta;
  return typeof meta === "object" && meta !== null
    ? meta as Record<string, unknown>
    : {};
}

export function startMcpToolObservation(
  observability: McpRequestObservability | undefined,
  toolName: McpToolName,
): McpToolObservationScope {
  const now = observability?.now ?? Date.now;
  const startedAt = now();

  return {
    complete<Result extends object>(
      outcome: McpToolOutcome,
      result: Result,
      failed = false,
    ): Result & { readonly _meta?: Record<string, unknown> } {
      const durationMs = Math.max(0, now() - startedAt);
      if (!observability) return result;

      observability.emit({
        event: failed ? "mcp.tool.failed" : "mcp.tool.completed",
        requestId: observability.requestId,
        toolName,
        outcome,
        durationMs,
      });

      return {
        ...result,
        _meta: {
          ...resultMeta(result),
          "abcoda/requestId": observability.requestId,
        },
      };
    },
  };
}
