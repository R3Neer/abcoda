import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BaselineAbcCodec } from "../../../../packages/abc-codec/src/index";
import {
  EvaluateScore,
  PresentScore,
} from "../../../../packages/application/src/index";
import {
  evaluateScoreRequestSchema,
  evaluateScoreResultSchema,
  legacyRenderScoreRequestSchema,
  renderScoreToolInputSchema,
  type LegacyRenderScoreRequest,
  type ScorePresentationDto,
  type ScoreSnapshotDto,
  versions,
  widgetResourceUri,
} from "../../../../packages/contracts/src/index";
import {
  asQuarterNoteBpm,
  asTuneId,
  asVoiceId,
  type ScoreSnapshot,
} from "../../../../packages/domain/src/index";
import type { WidgetArtifact } from "../assets/widget-artifact";

export type WidgetLoader = () => Promise<WidgetArtifact>;

function legacyPresentation(input: LegacyRenderScoreRequest): ScorePresentationDto {
  return {
    tempo: input.playback.tempo,
    instruments: Object.fromEntries(
      Object.entries(input.playback.instruments).map(([voiceId, instrument]) => [
        voiceId,
        instrument === "percussion" ? "standard_drum_kit" : instrument,
      ]),
    ),
    mutedVoices: input.playback.mutedVoices,
    loop: input.playback.loop,
    ...(input.display.title === undefined ? {} : { title: input.display.title }),
    ...(input.display.preferredMeasuresPerLine === undefined
      ? {}
      : { preferredMeasuresPerLine: input.display.preferredMeasuresPerLine }),
  };
}

function applyLegacyVoiceKinds(
  snapshot: ScoreSnapshot,
  voiceKinds: LegacyRenderScoreRequest["notation"]["voiceKinds"],
): ScoreSnapshot {
  return {
    ...snapshot,
    document: {
      ...snapshot.document,
      voices: snapshot.document.voices.map((voice) => ({
        ...voice,
        kind: voiceKinds[voice.id] ?? voice.kind,
      })),
    },
  };
}

function toDomainSnapshot(snapshot: ScoreSnapshotDto): ScoreSnapshot {
  return {
    schemaVersion: snapshot.schemaVersion,
    revision: snapshot.revision,
    document: {
      source: snapshot.document.source,
      tuneId: asTuneId(snapshot.document.tuneId),
      voices: snapshot.document.voices.map((voice) => ({
        id: asVoiceId(voice.id),
        kind: voice.kind,
      })),
      ...(snapshot.document.title === undefined
        ? {}
        : { title: snapshot.document.title }),
      ...(snapshot.document.meter === undefined
        ? {}
        : { meter: snapshot.document.meter }),
      ...(snapshot.document.key === undefined
        ? {}
        : { key: snapshot.document.key }),
      ...(snapshot.document.tempo === undefined
        ? {}
        : {
            tempo: {
              beatUnit: "quarter" as const,
              bpm: asQuarterNoteBpm(snapshot.document.tempo.bpm),
            },
          }),
    },
    diagnostics: snapshot.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      ...(diagnostic.range === undefined ? {} : { range: diagnostic.range }),
    })),
  };
}

export function createV2McpServer(loadWidget?: WidgetLoader): McpServer {
  const server = new McpServer({
    name: "ABCoda",
    version: versions.appVersion,
  });
  const evaluateScore = new EvaluateScore(new BaselineAbcCodec());
  const presentScore = new PresentScore(evaluateScore);

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
          ? `Validated revision ${result.snapshot.revision} with ${result.snapshot.document.voices.length} voice${result.snapshot.document.voices.length === 1 ? "" : "s"}.`
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
        try {
          const input = renderScoreToolInputSchema.parse(rawInput);
          const result = input.schemaVersion === 1
            ? evaluateScore.execute({ abc: input.abc, revision: 0 })
            : presentScore.execute({ snapshot: toDomainSnapshot(input.snapshot) });
          const adapted = input.schemaVersion === 1 && result.status === "success"
            ? {
                ...result,
                snapshot: applyLegacyVoiceKinds(result.snapshot, input.notation.voiceKinds),
                presentation: legacyPresentation(legacyRenderScoreRequestSchema.parse(input)),
              }
            : input.schemaVersion === 2 && input.presentation !== undefined
              ? { ...result, presentation: input.presentation }
              : result;
          return {
            structuredContent: adapted,
            content: [
              {
                type: "text" as const,
                text: adapted.status === "success"
                  ? `Prepared revision ${adapted.snapshot.revision} for interactive presentation${input.schemaVersion === 1 ? " through the schema 1 compatibility adapter" : ""}.`
                  : "The score could not be presented because validation failed.",
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid presentation request.";
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Could not present score: ${message}` }],
          };
        }
      },
    );

    registerAppResource(
      server,
      "ABCoda v2 score widget",
      widgetResourceUri,
      {
        description: "Interactive ABC score rendered by the isolated architecture v2 widget.",
        mimeType: RESOURCE_MIME_TYPE,
        _meta: {
          ui: {
            csp: { connectDomains: [], resourceDomains: [] },
            prefersBorder: false,
          },
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
                csp: { connectDomains: [], resourceDomains: [] },
                prefersBorder: false,
              },
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
