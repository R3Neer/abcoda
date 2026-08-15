import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BaselineAbcCodec } from "../../../../packages/abc-codec/src/index";
import { EvaluateScore } from "../../../../packages/application/src/index";
import {
  evaluateScoreRequestSchema,
  evaluateScoreResultSchema,
  versions,
} from "../../../../packages/contracts/src/index";

export function createV2McpServer(): McpServer {
  const server = new McpServer({
    name: "ABCoda",
    version: versions.appVersion,
  });
  const evaluateScore = new EvaluateScore(new BaselineAbcCodec());

  registerAppTool(
    server,
    "validate_score",
    {
      title: "Validate an ABC score",
      description:
        "Validate exactly one complete ABC tune and return a revisioned score snapshot or structured diagnostics. This data tool does not mount a UI.",
      inputSchema: evaluateScoreRequestSchema,
      outputSchema: evaluateScoreResultSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Validating the score…",
        "openai/toolInvocation/invoked": "Score validation complete",
      },
    },
    (rawInput) => {
      try {
        const command = evaluateScoreRequestSchema.parse(rawInput);
        const result = evaluateScore.execute(command);
        const text = result.status === "success"
          ? `Validated revision ${result.snapshot.revision} with ${result.snapshot.document.voiceIds.length} voice${result.snapshot.document.voiceIds.length === 1 ? "" : "s"}.`
          : `Score validation found ${result.diagnostics.length} blocking diagnostic${result.diagnostics.length === 1 ? "" : "s"}.`;
        return {
          structuredContent: result,
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid score request.";
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Could not validate score: ${message}` }],
        };
      }
    },
  );

  return server;
}
