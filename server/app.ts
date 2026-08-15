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
import { scoreVoiceOrder } from "../shared/voices.js";

export const widgetUri = "ui://abcoda/score-v18.html";
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
    { name: "ABCoda", version: "0.12.0" },
    { instructions: abcodaComposerInstructions },
  );

  registerAppTool(
    server,
    "prepare_composition",
    {
      title: "Prepare a composition brief",
      description:
        "Use this when the user asks to compose or arrange new music. Infer the complete typed brief, including composition effort, from stated constraints and responsible defaults. ABCoda routes the selected style, form, pitch, rhythm, texture, and instruments into a silent macro-to-micro review with scope-aware backtracking, followed by separate mechanical preflight. Do not use when merely rendering ABC already supplied by the user.",
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
        "Use this to render complete abcjs-compatible ABC with interactive playback, score transposition, an editable ABC source view, and safe pitched/percussion voice switching. For newly composed or arranged music, call prepare_composition first and pass its same brief as composition. For user-supplied ABC, composition may be omitted. Validate bar durations, meter-aware beam grouping, ranges, clefs, transposition, voice IDs, and tempo; mark unpitched voices in notation.voiceKinds and use the percussion playback instrument.",
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
          voiceIds: scoreVoiceOrder(score.abc),
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
      description: "Interactive ABC notation renderer, editor, transposer, and player.",
      mimeType: RESOURCE_MIME_TYPE,
      _meta: {
        ui: {
          csp: widgetCsp,
          domain: widgetDomain,
          prefersBorder: false,
        },
        "openai/widgetDescription": "Interactive ABC music score with playback, transposition, instrument, and source-code controls.",
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
            "openai/widgetDescription": "Interactive ABC music score with playback, transposition, instrument, and source-code controls.",
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
