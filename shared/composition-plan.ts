import { z } from "zod/v4";

export const styleFamilies = [
  "medieval_renaissance",
  "baroque",
  "classical",
  "romantic",
  "impressionist_coloristic",
  "jazz_blues",
  "pop_rock_funk_rnb",
  "folk_traditional_dance",
  "minimalist_electronic_cinematic",
  "atonal_post_tonal",
  "experimental_free",
  "other_hybrid",
] as const;

export const voiceRoles = [
  "melody",
  "bass",
  "harmony",
  "countermelody",
  "inner_voice",
  "beat",
  "color",
  "solo",
  "other",
] as const;

export const compositionBriefSchema = z.object({
  styleFamily: z.enum(styleFamilies).describe("The closest governing idiom; use other_hybrid only when no family fits."),
  styleDetail: z.string().min(1).max(160).optional().describe("Era, genre, regional practice, or high-level stylistic traits."),
  form: z.string().min(1).max(160).describe("Phrase/section plan, such as period, 12-bar blues, AABA, invention, or through-composed arc."),
  measures: z.number().int().min(1).max(512).describe("Target written measure count before repeat expansion."),
  meter: z.string().min(1).max(40).describe("ABC-compatible meter or deliberate free meter."),
  tempo: z.number().int().min(20).max(300).describe("Quarter-note beats per minute for ABCoda playback."),
  pitchLanguage: z.string().min(1).max(160).describe("Key, mode, collection, row, centricity, or other pitch organisation."),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "virtuosic"]),
  intent: z.enum(["performance", "study", "illustration", "accompaniment", "sketch"]),
  ensemble: z.array(z.object({
    voiceId: z.string().min(1).max(32).regex(/^[A-Za-z0-9_.-]+$/),
    instrument: z.string().min(1).max(100),
    role: z.enum(voiceRoles),
    kind: z.enum(["pitched", "unpitched_percussion"]).default("pitched"),
  })).min(1).max(32),
  constraints: z.array(z.string().min(1).max(240)).max(24).default([]),
});

export type CompositionBrief = z.infer<typeof compositionBriefSchema>;

export const compositionPlanOutputSchema = z.object({
  schemaVersion: z.literal(1),
  brief: compositionBriefSchema,
  guidance: z.object({
    style: z.array(z.string()),
    formAndDevelopment: z.array(z.string()),
    textureAndInstruments: z.array(z.string()),
    notation: z.array(z.string()),
    preflight: z.array(z.string()),
  }),
  prompt: z.string(),
});

export type CompositionPlanOutput = z.infer<typeof compositionPlanOutputSchema>;

const styleGuidance: Record<CompositionBrief["styleFamily"], string[]> = {
  medieval_renaissance: [
    "Let modal centre, melodic contour, and independent singable lines govern the pitch language.",
    "Control dissonance through preparation, metric placement, and resolution according to the requested contrapuntal practice; do not import later functional harmony automatically.",
  ],
  baroque: [
    "Derive the texture from compact motives using imitation, sequence, and contrapuntal recombination over directed tonal bass motion.",
    "If the form is an invention or fugue, plan subject, answer, companion/countersubject, entries, episodes, tonal route, and final intensification before writing notes.",
  ],
  classical: [
    "Make phrase functions and cadential hierarchy audible; use sentence, period, hybrid, or another declared theme type rather than arbitrary four-bar blocks.",
    "Use economical motivic development and a clear tonal trajectory while allowing asymmetry when the brief requires it.",
  ],
  romantic: [
    "Use expanded phrase rhythm, chromatic voice leading, mixture/tonicisation, and expressive register in service of a long-range arrival.",
    "Keep dense harmony and rubato-like surface detail subordinate to playable lines and formal direction.",
  ],
  impressionist_coloristic: [
    "Organise colour through mode/collection, pedals, planing, added-note sonorities, spacing, resonance, and register.",
    "Treat parallel motion or unresolved colour tones as valid grammar when intentional; do not force a common-practice cadence onto them.",
  ],
  jazz_blues: [
    "Define groove and form first, then use idiomatic blues, modal, or functional syntax with selective extensions and alterations.",
    "Connect voicings through guide tones and purposeful bass motion; leave rhythmic and registral space instead of stacking every available tension.",
  ],
  pop_rock_funk_rnb: [
    "Build around a memorable hook/riff, stable groove, cyclic or root-position harmony where idiomatic, and clear sectional contrast.",
    "Use functional layers—beat, bass, harmonic filler, melody, and optional novelty/call-response—rather than making every voice move as a Classical chorale.",
  ],
  folk_traditional_dance: [
    "Respect the requested tune type's meter, accent pattern, mode, range, phrase length, ornaments, and repetition scheme.",
    "Prefer a convincing single tradition over an unsupported collage of regional markers.",
  ],
  minimalist_electronic_cinematic: [
    "Make process, ostinato, pulse, layering, density, register, and timbral change carry the form.",
    "Give repetition a perceptible process or dramatic function through addition, subtraction, phase, reharmonisation, or orchestral transfer.",
  ],
  atonal_post_tonal: [
    "State and preserve an organising principle such as an interval cell, collection, axis/centricity, set relation, or row operation.",
    "Create continuity through recurrence and transformation; do not smuggle in tonal cadences unless the brief explicitly combines systems.",
  ],
  experimental_free: [
    "Let gesture, register, density, articulation, silence, process, or timbre provide structure when metre and functional harmony do not.",
    "Use M:none only deliberately and stay within notation that abcjs can represent clearly.",
  ],
  other_hybrid: [
    "Name which traits come from each source idiom and decide which one governs harmony/pitch, rhythm, form, texture, and instrumentation.",
    "Resolve conflicts explicitly instead of averaging the idioms into generic tonal music.",
  ],
};

function formGuidance(brief: CompositionBrief): string[] {
  const scale = brief.measures <= 8
    ? "Use one principal idea and one convincing arrival; keep development economical."
    : brief.measures <= 32
      ? "Establish, vary, contrast, and return or resolve the principal material across the declared sections."
      : "Track tonal/pitch, textural, registral, and thematic trajectories across sections so the long form has hierarchy.";
  return [
    `Realise the declared form “${brief.form}” across approximately ${brief.measures} written measures; do not merely label sections after composing.`,
    scale,
    "Make repetitions audible but changed when development is expected, using sequence, fragmentation, displacement, register, reharmonisation, orchestration, call-response, or subtraction.",
  ];
}

function textureGuidance(brief: CompositionBrief): string[] {
  const parts = brief.ensemble.map((voice) =>
    `${voice.voiceId}: ${voice.instrument}, role=${voice.role}, kind=${voice.kind}`,
  );
  return [
    `Write specifically for: ${parts.join("; ")}.`,
    "Keep every part in a credible range and tessitura, physically plausible, balanced in register/density, and differentiated by role.",
    "Use rests, entrances, exits, register, and articulation as compositional material; continuous doubling or tutti must be intentional.",
  ];
}

function notationGuidance(brief: CompositionBrief): string[] {
  const percussion = brief.ensemble.filter((voice) => voice.kind === "unpitched_percussion").map((voice) => voice.voiceId);
  return [
    `Encode M:${brief.meter}, Q:1/4=${brief.tempo}, and the pitch language “${brief.pitchLanguage}” with an appropriate K: field or K:none.`,
    "Declare stable V: IDs, suitable clefs/names, and %%score; keep every simultaneous voice rhythmically complete through each full bar and end voices together with |].",
    percussion.length > 0
      ? `Set notation.voiceKinds for ${percussion.join(", ")} to unpitched_percussion; use percussion clef/no key signature and do not promise realistic drum-kit samples in the current MVP.`
      : "Use notation.voiceKinds={} unless an explicitly unpitched percussion voice is added.",
    "Use only abcjs-compatible ABC constructs and supported playback instrument names; do not invent directives.",
  ];
}

export function buildCompositionPlan(brief: CompositionBrief): CompositionPlanOutput {
  const guidance = {
    style: styleGuidance[brief.styleFamily],
    formAndDevelopment: formGuidance(brief),
    textureAndInstruments: textureGuidance(brief),
    notation: notationGuidance(brief),
    preflight: [
      `Respect difficulty=${brief.difficulty} and intent=${brief.intent}; verify every explicit constraint: ${brief.constraints.join("; ") || "none beyond the brief"}.`,
      "Before render_score, silently verify musical coherence, style, playability, headers, voice IDs, bar durations, accidentals, ties/repeats, clefs, final bars, and tempo.",
      "Revise substantive warnings instead of claiming success merely because the renderer accepted the input.",
    ],
  };
  const prompt = [
    `COMPOSITION PROFILE: ${brief.styleFamily}${brief.styleDetail ? ` — ${brief.styleDetail}` : ""}.`,
    ...guidance.style,
    ...guidance.formAndDevelopment,
    ...guidance.textureAndInstruments,
    ...guidance.notation,
    ...guidance.preflight,
  ].join("\n- ");
  return { schemaVersion: 1, brief, guidance, prompt };
}

