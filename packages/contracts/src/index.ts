import { z } from "zod/v4";

export const versions = {
  appVersion: "0.13.0-alpha.1",
  schemaVersion: 2,
  rulesVersion: 4,
} as const;

export const widgetResourceUri = `ui://abcoda/score-schema-${versions.schemaVersion}.html`;

export interface BuildManifest {
  readonly appVersion: typeof versions.appVersion;
  readonly schemaVersion: typeof versions.schemaVersion;
  readonly rulesVersion: typeof versions.rulesVersion;
  readonly artifactHash: string;
}

export function createBuildManifest(artifactHash: string): BuildManifest {
  if (!/^[a-f0-9]{8,64}$/i.test(artifactHash)) {
    throw new Error("artifactHash must be an 8 to 64 character hexadecimal digest.");
  }
  return { ...versions, artifactHash: artifactHash.toLowerCase() };
}

export const evaluateScoreRequestSchema = z.object({
  schemaVersion: z.literal(2).default(2),
  abc: z.string().min(1).max(65_536),
  revision: z.number().int().min(0).default(0),
});

export type EvaluateScoreRequest = z.infer<typeof evaluateScoreRequestSchema>;

const sourcePositionSchema = z.object({
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  offset: z.number().int().min(0),
});

const sourceRangeSchema = z.object({
  start: sourcePositionSchema,
  end: sourcePositionSchema,
});

export const diagnosticSchema = z.object({
  code: z.enum([
    "ABC_TUNE_REFERENCE_MISSING",
    "ABC_MULTIPLE_TUNES_UNSUPPORTED",
    "ABC_TUNE_REFERENCE_INVALID",
    "ABC_VOICE_ID_INVALID",
    "ABC_SOURCE_EMPTY",
    "ABC_TRANSPOSITION_FAILED",
  ]),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string().min(1),
  range: sourceRangeSchema.optional(),
});

export const scoreSnapshotSchema = z.object({
  schemaVersion: z.literal(2),
  revision: z.number().int().min(0),
  document: z.object({
    tuneId: z.string().min(1),
    title: z.string().min(1).optional(),
    meter: z.string().min(1).optional(),
    key: z.string().min(1).optional(),
    tempo: z.object({
      beatUnit: z.literal("quarter"),
      bpm: z.number().int().min(20).max(300),
    }).optional(),
    voices: z.array(z.object({
      id: z.string().min(1),
      kind: z.enum(["pitched", "unpitched_percussion"]),
    })).min(1),
    source: z.object({
      format: z.literal("abc"),
      text: z.string().min(1).max(65_536),
    }),
  }),
  diagnostics: z.array(diagnosticSchema),
});

export type ScoreSnapshotDto = z.infer<typeof scoreSnapshotSchema>;

export const evaluateScoreResultSchema = z.object({
  status: z.enum(["success", "invalid"]),
  snapshot: scoreSnapshotSchema.optional(),
  diagnostics: z.array(diagnosticSchema).optional(),
}).superRefine((result, context) => {
  if (result.status === "success" && !result.snapshot) {
    context.addIssue({
      code: "custom",
      message: "A successful score evaluation requires a snapshot.",
      path: ["snapshot"],
    });
  }
  if (result.status === "invalid" && !result.diagnostics) {
    context.addIssue({
      code: "custom",
      message: "An invalid score evaluation requires diagnostics.",
      path: ["diagnostics"],
    });
  }
});

export type EvaluateScoreResultDto = z.infer<typeof evaluateScoreResultSchema>;

export const presentScoreRequestSchema = z.object({
  schemaVersion: z.literal(2).default(2),
  snapshot: scoreSnapshotSchema,
});

export type PresentScoreRequest = z.infer<typeof presentScoreRequestSchema>;
