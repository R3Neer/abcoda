import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CanonicalAbcCodec,
  synchronizeInstrumentationAbc,
} from "@abcoda/abc-codec";
import {
  abcodaComposerInstructions,
  buildCompositionPlan,
  compositionBriefSchema,
  compositionPlanOutputSchema,
} from "@abcoda/composition";
import {
  EvaluateScore,
  PrepareComposition,
} from "@abcoda/application";
import {
  evaluateScoreRequestSchema,
  evaluateScoreResultSchema,
  renderScoreToolInputSchema,
  versions,
  widgetResourceUri,
} from "@abcoda/contracts";
import type { WidgetArtifact } from "../assets/widget-artifact";
import {
  startMcpToolObservation,
  type McpRequestObservability,
} from "./request-observability";
import { toEvaluateScoreResultDto } from "./score-contract-mapper";

export type WidgetLoader = () => Promise<WidgetArtifact>;

const widgetDomain = "https://abcoda.mud-repo-patcher-mcp-probe.workers.dev";

const widgetResourceCsp = {
  connectDomains: ["https://paulrosen.github.io"],
  resourceDomains: [],
};

export function createMcpServer(
  loadWidget?: WidgetLoader,
  observability?: McpRequestObservability,
): McpServer {
  const server = new McpServer(
    {
      name: "ABCoda",
      version: versions.appVersion,
    },
    { instructions: abcodaComposerInstructions },
  );
  const evaluateScore = new EvaluateScore(new CanonicalAbcCodec());
  const prepareComposition = new PrepareComposition({ prepare: buildCompositionPlan });

  registerAppTool(
    server,
    "prepare_composition",
    {
      title: "Prepare a composition brief",
      description:
        "Use when composing or arranging new music. Return a typed, rules-versioned generation and silent-review plan. Do not use merely to render ABC supplied by the user.",
      inputSchema: compositionBriefSchema,
      outputSchema: compositionPlanOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Planning the composition…",
        "openai/toolInvocation/invoked": "Composition plan ready",
      },
    },
    (rawInput) => {
      const observation = startMcpToolObservation(observability, "prepare_composition");
      try {
        const result = prepareComposition.execute({ brief: compositionBriefSchema.parse(rawInput) });
        return observation.complete("success", {
          structuredContent: result,
          content: [{ type: "text" as const, text: result.prompt }],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid composition brief.";
        return observation.complete("failure", {
          isError: true,
          content: [{ type: "text" as const, text: `Could not prepare composition: ${message}` }],
        }, true);
      }
    },
  );

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
      const observation = startMcpToolObservation(observability, "validate_score");
      try {
        const command = evaluateScoreRequestSchema.parse(rawInput);
        const result = toEvaluateScoreResultDto(evaluateScore.execute(command));
        const text = result.status === "success" && result.snapshot
          ? `Validated revision ${result.snapshot.revision} with ${result.snapshot.document.voices.length} voice${result.snapshot.document.voices.length === 1 ? "" : "s"}.`
          : `Score validation found ${result.diagnostics?.length ?? 0} blocking diagnostic${result.diagnostics?.length === 1 ? "" : "s"}.`;
        return observation.complete(result.status, {
          structuredContent: result,
          content: [{ type: "text" as const, text }],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid score request.";
        return observation.complete("failure", {
          isError: true,
          content: [{ type: "text" as const, text: `Could not validate score: ${message}` }],
        }, true);
      }
    },
  );

  if (loadWidget) {
    registerAppTool(
      server,
      "render_score",
      {
        title: "Render an interactive ABC score",
        description:
          "Present a score snapshot returned by validate_score. The source is re-evaluated before presentation and the result remains useful when the host ignores the UI.",
        inputSchema: renderScoreToolInputSchema,
        outputSchema: evaluateScoreResultSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        _meta: {
          ui: { resourceUri: widgetResourceUri },
          "openai/outputTemplate": widgetResourceUri,
          "openai/toolInvocation/invoking": "Preparing the score…",
          "openai/toolInvocation/invoked": "Score ready",
        },
      },
      (rawInput) => {
        const observation = startMcpToolObservation(observability, "render_score");
        try {
          const input = renderScoreToolInputSchema.parse(rawInput);
          const source = input.presentation === undefined
            ? input.snapshot.document.source.text
            : synchronizeInstrumentationAbc(
                input.snapshot.document.source.text,
                input.presentation.instruments,
              );
          const result = toEvaluateScoreResultDto(evaluateScore.execute({
            abc: source,
            revision: input.snapshot.revision,
          }));
          const adapted = input.presentation !== undefined
            ? { ...result, presentation: input.presentation }
            : result;
          return observation.complete(adapted.status, {
            structuredContent: adapted,
            content: [{
              type: "text" as const,
              text: adapted.status === "success" && adapted.snapshot
                ? `Prepared revision ${adapted.snapshot.revision} for interactive presentation.`
                : "The score could not be presented because validation failed.",
            }],
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid presentation request.";
          return observation.complete("failure", {
            isError: true,
            content: [{ type: "text" as const, text: `Could not present score: ${message}` }],
          }, true);
        }
      },
    );

    registerAppResource(
      server,
      "ABCoda score widget",
      widgetResourceUri,
      {
        description: "Interactive ABC score rendered by ABCoda.",
        mimeType: RESOURCE_MIME_TYPE,
        _meta: {
          ui: {
            domain: widgetDomain,
            csp: widgetResourceCsp,
            prefersBorder: false,
          },
          "openai/widgetDomain": widgetDomain,
          "openai/widgetDescription": "Interactive music notation for a validated ABC score.",
          "openai/widgetPrefersBorder": false,
        },
      },
      async () => {
        const artifact = await loadWidget();
        return {
          contents: [{
            uri: widgetResourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: artifact.html,
            _meta: {
              "abcoda/artifactHash": artifact.manifest.artifactHash,
              ui: {
                domain: widgetDomain,
                csp: widgetResourceCsp,
                prefersBorder: false,
              },
              "openai/widgetDomain": widgetDomain,
              "openai/widgetDescription": "Interactive music notation for a validated ABC score.",
              "openai/widgetPrefersBorder": false,
            },
          }],
        };
      },
    );
  }

  return server;
}
