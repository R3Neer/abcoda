import { z } from "zod/v4";
import { compositionBriefSchema } from "./composition-plan.js";

export const instrumentProgram = {
  acoustic_grand_piano: 0,
  bright_acoustic_piano: 1,
  church_organ: 19,
  acoustic_guitar_nylon: 24,
  acoustic_bass: 32,
  violin: 40,
  viola: 41,
  cello: 42,
  contrabass: 43,
  string_ensemble_1: 48,
  choir_aahs: 52,
  trumpet: 56,
  trombone: 57,
  french_horn: 60,
  soprano_sax: 64,
  alto_sax: 65,
  tenor_sax: 66,
  oboe: 68,
  english_horn: 69,
  bassoon: 70,
  clarinet: 71,
  piccolo: 72,
  flute: 73,
  recorder: 74,
  percussion: 128,
} as const;

export type InstrumentName = keyof typeof instrumentProgram;
export const instrumentNames = Object.keys(instrumentProgram) as InstrumentName[];

export const instrumentSchema = z.enum(
  instrumentNames as [InstrumentName, ...InstrumentName[]],
);

export const renderScoreInputSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  abc: z.string().min(1).max(65_536).describe("A complete score in ABC notation."),
  composition: compositionBriefSchema.optional().describe("The typed brief returned by prepare_composition when composing rather than only rendering supplied ABC."),
  playback: z
    .object({
      tempo: z.number().int().min(20).max(300).default(96),
      instruments: z.record(z.string(), instrumentSchema).default({}),
      mutedVoices: z.array(z.string()).default([]),
      loop: z.boolean().default(false),
    })
    .default({ tempo: 96, instruments: {}, mutedVoices: [], loop: false }),
  notation: z
    .object({
      voiceKinds: z
        .record(z.string(), z.enum(["pitched", "unpitched_percussion"]))
        .default({})
        .describe("Notation role by V: voice ID. Mark drum-kit and auxiliary unpitched voices as unpitched_percussion."),
    })
    .default({ voiceKinds: {} }),
  display: z
    .object({
      title: z.string().max(120).optional(),
      coloredVoices: z.boolean().default(false)
        .describe("Deprecated compatibility field. ABCoda renders every voice in the same host-theme foreground color."),
      preferredMeasuresPerLine: z.number().int().min(1).max(8).optional(),
    })
    .default({ coloredVoices: false }),
});

export type RenderScoreInput = z.infer<typeof renderScoreInputSchema>;

export const renderScoreOutputSchema = z.object({
  schemaVersion: z.literal(1),
  score: renderScoreInputSchema,
  voiceIds: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type RenderScoreOutput = z.infer<typeof renderScoreOutputSchema>;
