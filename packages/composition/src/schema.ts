import { z } from "zod/v4";

export const styleFamilies = [
  "medieval_renaissance", "baroque", "classical", "romantic",
  "impressionist_coloristic", "jazz_blues", "pop_rock_funk_rnb",
  "folk_traditional_dance", "minimalist_electronic_cinematic",
  "atonal_post_tonal", "experimental_free", "other_hybrid",
] as const;

export const formFamilies = [
  "period", "sentence", "binary", "rounded_binary", "ternary", "rondo",
  "sonata", "variation", "through_composed", "strophic", "verse_chorus",
  "aaba", "twelve_bar_blues", "fugue_invention", "canon", "dance",
  "process", "free", "other",
] as const;

export const pitchFrameworks = [
  "tonal_functional", "tonal_cyclic", "modal", "blues", "jazz_extended",
  "pentatonic", "symmetric_collection", "atonal_centric",
  "set_or_interval_cell", "twelve_tone", "other",
] as const;

export const rhythmicFeels = [
  "straight", "swing", "shuffle", "syncopated_groove", "dance_pattern",
  "rubato_flexible", "motoric_ostinato", "asymmetric_additive", "free", "mixed",
] as const;

export const textureModels = [
  "monophonic", "heterophonic", "melody_accompaniment", "homorhythmic",
  "contrapuntal", "layered_groove", "color_mass", "mixed",
] as const;

export const instrumentFamilies = [
  "keyboard", "bowed_string", "plucked_string", "guitar", "bass", "woodwind",
  "brass", "voice", "pitched_percussion", "drum_kit",
  "unpitched_percussion", "electronic", "other",
] as const;

export const voiceRoles = [
  "melody", "bass", "harmony", "countermelody", "inner_voice", "beat",
  "color", "solo", "other",
] as const;

export const difficultyLevels = ["beginner", "intermediate", "advanced", "virtuosic"] as const;
export const compositionIntents = ["performance", "study", "illustration", "accompaniment", "sketch"] as const;
export const compositionEffortLevels = ["quick", "standard", "careful", "exhaustive"] as const;

const sectionSchema = z.object({
  label: z.string().min(1).max(40),
  measures: z.number().int().min(1).max(512).optional(),
  function: z.string().min(1).max(160),
});

const ensembleVoiceSchema = z.object({
  voiceId: z.string().min(1).max(32).regex(/^[A-Za-z0-9_.-]+$/),
  instrument: z.string().min(1).max(100),
  family: z.enum(instrumentFamilies).default("other"),
  role: z.enum(voiceRoles),
  kind: z.enum(["pitched", "unpitched_percussion"]).default("pitched"),
  transpositionSemitones: z.number().int().min(-36).max(36).default(0)
    .describe("Written-to-sounding playback transposition; 0 for concert-pitch notation."),
});

export const compositionBriefSchema = z.object({
  styleFamily: z.enum(styleFamilies).describe("The governing idiom; style controls vocabulary, not automatically the form or pitch system."),
  styleDetail: z.string().min(1).max(160).optional().describe("Era, genre, regional practice, or high-level traits. Required in practice for a specific tradition."),
  formFamily: z.enum(formFamilies).default("other").describe("Structural archetype used to select form-specific guidance."),
  form: z.string().min(1).max(240).describe("Concrete phrase/section plan and any deliberate alteration of the archetype."),
  sectionPlan: z.array(sectionSchema).max(24).default([]),
  measures: z.number().int().min(1).max(512).describe("Target written measure count before repeat expansion."),
  meter: z.string().min(1).max(40).describe("ABC-compatible meter or deliberate free meter."),
  tempo: z.number().int().min(20).max(300).describe("Quarter-note beats per minute for ABCoda playback."),
  rhythmicFeel: z.enum(rhythmicFeels).default("mixed"),
  pitchFramework: z.enum(pitchFrameworks).default("other")
    .describe("The operative pitch/harmonic system. This overrides stylistic defaults when they conflict."),
  pitchLanguage: z.string().min(1).max(200).describe("Specific key, mode, collection, row, centricity, chord language, or other organisation."),
  texture: z.enum(textureModels).default("mixed"),
  difficulty: z.enum(difficultyLevels),
  effort: z.enum(compositionEffortLevels).default("standard")
    .describe("Composition and silent-review effort; independent of performer difficulty."),
  intent: z.enum(compositionIntents),
  ensemble: z.array(ensembleVoiceSchema).min(1).max(32),
  constraints: z.array(z.string().min(1).max(240)).max(24).default([]),
  departures: z.array(z.string().min(1).max(240)).max(16).default([])
    .describe("Explicit permissions to depart from ordinary conventions; these override generated defaults."),
});

export type CompositionBrief = z.infer<typeof compositionBriefSchema>;

const guidanceSchema = z.object({
  priorities: z.array(z.string()), style: z.array(z.string()), form: z.array(z.string()),
  pitch: z.array(z.string()), rhythm: z.array(z.string()), texture: z.array(z.string()),
  instruments: z.array(z.string()), difficultyAndIntent: z.array(z.string()),
  notation: z.array(z.string()), preflight: z.array(z.string()),
});

const reviewSchema = z.object({
  strategy: z.array(z.string()),
  macro: z.array(z.string()),
  meso: z.array(z.string()),
  local: z.array(z.string()),
  performance: z.array(z.string()),
  finalHolisticAudit: z.array(z.string()),
});

export const compositionPlanOutputSchema = z.object({
  schemaVersion: z.literal(4),
  brief: compositionBriefSchema,
  guidance: guidanceSchema,
  review: reviewSchema,
  compatibilityNotes: z.array(z.string()),
  renderHints: z.object({
    tempo: z.number().int(), meter: z.string(),
    voiceKinds: z.record(z.string(), z.enum(["pitched", "unpitched_percussion"])),
  }),
  prompt: z.string(),
});

export type CompositionPlanOutput = z.infer<typeof compositionPlanOutputSchema>;
export type StyleFamily = CompositionBrief["styleFamily"];
export type FormFamily = CompositionBrief["formFamily"];
export type PitchFramework = CompositionBrief["pitchFramework"];
export type RhythmicFeel = CompositionBrief["rhythmicFeel"];
export type TextureModel = CompositionBrief["texture"];
export type InstrumentFamily = CompositionBrief["ensemble"][number]["family"];
export type CompositionEffort = CompositionBrief["effort"];
