import ABCJS from "abcjs";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { renderScoreInputSchema, renderScoreOutputSchema } from "../shared/score.js";
import { extractVoiceIds } from "../shared/voices.js";

export const widgetUri = "ui://abcoda/score-v5.html";
const widgetDomain = "https://abcoda.mud-repo-patcher-mcp-probe.workers.dev";

const widgetCsp = {
  connectDomains: ["https://paulrosen.github.io"],
  resourceDomains: ["https://paulrosen.github.io"],
};

const legacyWidgetCsp = {
  connect_domains: ["https://paulrosen.github.io"],
  resource_domains: ["https://paulrosen.github.io"],
};

export type WidgetLoader = () => Promise<string>;

export function validateAbc(abc: string): string[] {
  const parsed = ABCJS.parseOnly(abc);
  return parsed.flatMap((tune) => tune.warnings ?? []).map(String);
}

export function createAbcodaServer(loadWidget: WidgetLoader): McpServer {
  const server = new McpServer({ name: "ABCoda", version: "0.1.0" });

  registerAppTool(
    server,
    "render_score",
    {
      title: "Render interactive music score",
      description:
        "Render valid ABC notation as an interactive score with playback. Use for musical examples, exercises, arrangements, and analysis. Voice IDs in playback.instruments must match V: fields in the ABC.",
      inputSchema: renderScoreInputSchema,
      outputSchema: renderScoreOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: widgetUri },
        "openai/outputTemplate": widgetUri,
        "openai/toolInvocation/invoking": "Preparing the score…",
        "openai/toolInvocation/invoked": "Score ready",
      },
    },
    async (rawInput) => {
      try {
        const score = renderScoreInputSchema.parse(rawInput);
        const warnings = validateAbc(score.abc);
        const result = {
          schemaVersion: 1 as const,
          score,
          voiceIds: extractVoiceIds(score.abc),
          warnings,
        };
        return {
          structuredContent: result,
          content: [
            {
              type: "text" as const,
              text: `Rendered an interactive score with ${result.voiceIds.length} voice${result.voiceIds.length === 1 ? "" : "s"}.`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid score input.";
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Could not render score: ${message}` }],
        };
      }
    },
  );

  registerAppResource(
    server,
    "ABCoda score player",
    widgetUri,
    {
      description: "Interactive ABC notation renderer and player.",
      mimeType: RESOURCE_MIME_TYPE,
      _meta: {
        ui: {
          csp: widgetCsp,
          domain: widgetDomain,
          prefersBorder: false,
        },
        "openai/widgetDescription": "Interactive ABC music score with playback controls.",
        "openai/widgetPrefersBorder": false,
        "openai/widgetCSP": legacyWidgetCsp,
        "openai/widgetDomain": widgetDomain,
      },
    },
    async () => ({
      contents: [
        {
          uri: widgetUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: await loadWidget(),
          _meta: {
            ui: {
              csp: widgetCsp,
              domain: widgetDomain,
              prefersBorder: false,
            },
            "openai/widgetDescription": "Interactive ABC music score with playback controls.",
            "openai/widgetPrefersBorder": false,
            "openai/widgetCSP": legacyWidgetCsp,
            "openai/widgetDomain": widgetDomain,
          },
        },
      ],
    }),
  );

  return server;
}
