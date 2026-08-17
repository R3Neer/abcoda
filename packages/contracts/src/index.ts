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
    "ABC_OPERATION_FAILED",
    "ABC_TEMPO_INVALID",
    "ABC_MEASURE_DURATION_MISMATCH",
    "ABC_VOICE_MEASURE_COUNT_MISMATCH",
    "UNSUPPORTED_ABC_FEATURE",
  ]),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string().min(1),
  range: sourceRangeSchema.optional(),
  suggestedCorrection: z.string().min(1).optional(),
});

export const instrumentIdSchema = z.enum([
  "acoustic_grand_piano",
  "bright_acoustic_piano",
  "church_organ",
  "acoustic_guitar_nylon",
  "acoustic_bass",
  "violin",
  "viola",
  "cello",
  "contrabass",
  "string_ensemble_1",
  "choir_aahs",
  "trumpet",
  "trombone",
  "french_horn",
  "soprano_sax",
  "alto_sax",
  "tenor_sax",
  "oboe",
  "english_horn",
  "bassoon",
  "clarinet",
  "piccolo",
  "flute",
  "recorder",
  "standard_drum_kit",
]);

export const scorePresentationSchema = z.object({
  tempo: z.number().int().min(20).max(300).optional(),
  instruments: z.record(z.string(), instrumentIdSchema).default({}),
  mutedVoices: z.array(z.string()).default([]),
  loop: z.boolean().default(false),
  title: z.string().max(120).optional(),
  preferredMeasuresPerLine: z.number().int().min(1).max(8).optional(),
});

export type ScorePresentationDto = z.infer<typeof scorePresentationSchema>;

export const playbackProfileSchema = z.object({
  tempo: z.number().int().min(20).max(300).optional(),
  instruments: z.record(z.string(), instrumentIdSchema).default({}),
  mutedVoices: z.array(z.string().min(1)).default([]),
  loop: z.boolean().default(false),
});

export type PlaybackProfileDto = z.infer<typeof playbackProfileSchema>;

export const scoreOperationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("transpose"),
    semitones: z.number().int().min(-24).max(24),
  }),
  z.object({
    kind: z.literal("assign_instrument"),
    voiceId: z.string().min(1),
    instrumentId: instrumentIdSchema,
  }),
  z.object({
    kind: z.literal("set_voice_muted"),
    voiceId: z.string().min(1),
    muted: z.boolean(),
  }),
  z.object({ kind: z.literal("restore_original") }),
]);

export type ScoreOperationDto = z.infer<typeof scoreOperationSchema>;

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
  status: z.enum(["success", "invalid", "unsupported", "failure"]),
  snapshot: scoreSnapshotSchema.optional(),
  diagnostics: z.array(diagnosticSchema).optional(),
  presentation: scorePresentationSchema.optional(),
}).superRefine((result, context) => {
  if (result.status === "success" && !result.snapshot) {
    context.addIssue({
      code: "custom",
      message: "A successful score evaluation requires a snapshot.",
      path: ["snapshot"],
    });
  }
  if (result.status !== "success" && !result.diagnostics) {
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
  presentation: scorePresentationSchema.optional(),
});

export type PresentScoreRequest = z.infer<typeof presentScoreRequestSchema>;

export const renderScoreToolInputSchema = presentScoreRequestSchema;
