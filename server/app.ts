import ABCJS from "abcjs";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { renderScoreInputSchema, renderScoreOutputSchema } from "../shared/score.js";
import { normalizeAndLintScore } from "../shared/abc-lint.js";
import { abcodaComposerInstructions } from "../shared/composer-instructions.js";
import {
  buildCompositionPlan,
  compositionBriefSchema,
  compositionPlanOutputSchema,
} from "../shared/composition-plan.js";
import { extractVoiceIds } from "../shared/voices.js";

export const widgetUri = "ui://abcoda/score-v10.html";
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
  const server = new McpServer(
    { name: "ABCoda", version: "0.2.0" },
    { instructions: abcodaComposerInstructions },
  );

  registerAppTool(
    server,
    "prepare_composition",
    {
      title: "Prepare a composition brief",
      description:
        "Call before composing or arranging. Infer a compact typed musical brief from the user's request; ABCoda returns style-specific theory, form, instrumentation, notation, and preflight guidance. Skip only when rendering ABC already supplied by the user.",
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
    async (rawInput) => {
      try {
        const brief = compositionBriefSchema.parse(rawInput);
        const result = buildCompositionPlan(brief);
        return {
          structuredContent: result,
          content: [{ type: "text" as const, text: result.prompt }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid composition brief.";
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Could not prepare composition: ${message}` }],
        };
      }
    },
  );

  registerAppTool(
    server,
    "render_score",
    {
      title: "Render interactive music score",
      description:
        "Render a complete, original, abcjs-compatible ABC score with interactive playback. Compose coherently for the requested style before encoding; validate bar durations, ranges, clefs, voices, and Q: tempo. Voice IDs in playback and notation must match V: fields. Mark unpitched drum voices in notation.voiceKinds.",
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
        const input = renderScoreInputSchema.parse(rawInput);
        const normalized = normalizeAndLintScore(input);
        const score = normalized.score;
        const warnings = [...normalized.warnings, ...validateAbc(score.abc)];
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
