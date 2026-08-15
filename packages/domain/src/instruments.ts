export type VoiceKind = "pitched" | "unpitched_percussion";

export const instrumentIds = [
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
] as const;

export type InstrumentId = (typeof instrumentIds)[number];

export interface InstrumentRange {
  readonly min: number;
  readonly max: number;
  readonly label: string;
}

export interface InstrumentDefinition {
  readonly id: InstrumentId;
  readonly label: string;
  readonly voiceKind: VoiceKind;
  readonly midiProgram?: number;

  /**
   * Normal musical tessitura used for warnings.
   * Notes outside this range can still be playable.
   */
  readonly usualRange: InstrumentRange;

  /**
   * Hard playback envelope used by ABCoda.
   * Pitched notes outside this range must never reach SoundFont loading.
   */
  readonly playableRange: InstrumentRange;

  /**
   * Temporary compatibility alias for the pre-playable-range API.
   * Patch B will migrate presentation code to usualRange/playableRange.
   */
  readonly range: InstrumentRange;
}

const createRange = (
  min: number,
  max: number,
  label: string,
): InstrumentRange => ({
  min,
  max,
  label,
});

const pitched = (
  id: Exclude<InstrumentId, "standard_drum_kit">,
  label: string,
  midiProgram: number,
  usualMin: number,
  usualMax: number,
  usualLabel: string,
  playableMin = usualMin,
  playableMax = usualMax,
  playableLabel = usualLabel,
): InstrumentDefinition => {
  const usualRange = createRange(
    usualMin,
    usualMax,
    usualLabel,
  );

  const playableRange = createRange(
    playableMin,
    playableMax,
    playableLabel,
  );

  return {
    id,
    label,
    voiceKind: "pitched",
    midiProgram,
    usualRange,
    playableRange,
    range: usualRange,
  };
};

/**
 * playableRange is deliberately an ABCoda playback policy, not a claim
 * about the absolute physical limit attainable by every performer.
 *
 * The envelope is conservative: it gives us a useful extended register
 * while preventing clearly incompatible pitches from reaching synthesis.
 */
export const instrumentCatalog: readonly InstrumentDefinition[] = [
  pitched(
    "acoustic_grand_piano",
    "Acoustic grand piano",
    0,
    21, 108, "A0–C8",
  ),
  pitched(
    "bright_acoustic_piano",
    "Bright acoustic piano",
    1,
    21, 108, "A0–C8",
  ),
  pitched(
    "church_organ",
    "Church organ",
    19,
    36, 96, "C2–C7",
    24, 108, "C1–C8",
  ),
  pitched(
    "acoustic_guitar_nylon",
    "Nylon-string guitar",
    24,
    40, 88, "E2–E6",
  ),
  pitched(
    "acoustic_bass",
    "Acoustic bass",
    32,
    28, 67, "E1–G4",
  ),
  pitched(
    "violin",
    "Violin",
    40,
    55, 105, "G3–A7",
    55, 108, "G3–C8",
  ),
  pitched(
    "viola",
    "Viola",
    41,
    48, 88, "C3–E6",
    48, 93, "C3–A6",
  ),
  pitched(
    "cello",
    "Cello",
    42,
    36, 84, "C2–C6",
    36, 88, "C2–E6",
  ),
  pitched(
    "contrabass",
    "Contrabass",
    43,
    28, 67, "E1–G4 sounding",
    28, 72, "E1–C5 sounding",
  ),
  pitched(
    "string_ensemble_1",
    "String ensemble",
    48,
    36, 96, "C2–C7",
    24, 108, "C1–C8",
  ),
  pitched(
    "choir_aahs",
    "Choir aahs",
    52,
    48, 84, "C3–C6",
    36, 96, "C2–C7",
  ),
  pitched(
    "trumpet",
    "Trumpet",
    56,
    54, 86, "F♯3–D6 sounding",
    52, 91, "E3–G6 sounding",
  ),
  pitched(
    "trombone",
    "Trombone",
    57,
    40, 72, "E2–C5",
    34, 77, "B♭1–F5",
  ),
  pitched(
    "french_horn",
    "French horn",
    60,
    35, 77, "B1–F5 sounding",
    34, 84, "B♭1–C6 sounding",
  ),
  pitched(
    "soprano_sax",
    "Soprano saxophone",
    64,
    56, 88, "A♭3–E6 sounding",
    56, 91, "A♭3–G6 sounding",
  ),
  pitched(
    "alto_sax",
    "Alto saxophone",
    65,
    49, 80, "C♯3–A♭5 sounding",
    49, 84, "C♯3–C6 sounding",
  ),
  pitched(
    "tenor_sax",
    "Tenor saxophone",
    66,
    44, 75, "A♭2–E♭5 sounding",
    44, 79, "A♭2–G5 sounding",
  ),
  pitched(
    "oboe",
    "Oboe",
    68,
    58, 93, "B♭3–A6",
    58, 96, "B♭3–C7",
  ),
  pitched(
    "english_horn",
    "English horn",
    69,
    52, 84, "E3–C6 sounding",
    51, 89, "E♭3–F6 sounding",
  ),
  pitched(
    "bassoon",
    "Bassoon",
    70,
    34, 75, "B♭1–E♭5",
    34, 82, "B♭1–B♭5",
  ),
  pitched(
    "clarinet",
    "Clarinet",
    71,
    52, 96, "E3–C7 sounding",
    50, 103, "D3–G7 sounding",
  ),
  pitched(
    "piccolo",
    "Piccolo",
    72,
    74, 108, "D5–C8 sounding",
  ),
  pitched(
    "flute",
    "Flute",
    73,
    60, 98, "C4–D7",
    59, 100, "B3–E7",
  ),
  pitched(
    "recorder",
    "Recorder",
    74,
    60, 96, "C4–C7",
    60, 98, "C4–D7",
  ),
  (() => {
    const range = createRange(
      35,
      81,
      "GM percussion notes 35–81",
    );

    return {
      id: "standard_drum_kit",
      label: "Standard drum kit",
      voiceKind: "unpitched_percussion",
      usualRange: range,
      playableRange: range,
      range,
    };
  })(),
] as const;

const definitions = new Map(
  instrumentCatalog.map(
    (instrument) => [instrument.id, instrument],
  ),
);

export function instrumentDefinition(
  id: InstrumentId,
): InstrumentDefinition {
  const definition = definitions.get(id);

  if (!definition) {
    throw new Error(`Unknown instrument ${id}.`);
  }

  return definition;
}

export function instrumentsForVoice(
  kind: VoiceKind,
): readonly InstrumentDefinition[] {
  return instrumentCatalog.filter(
    (instrument) => instrument.voiceKind === kind,
  );
}

export function defaultInstrument(
  kind: VoiceKind,
): InstrumentId {
  return kind === "unpitched_percussion"
    ? "standard_drum_kit"
    : "acoustic_grand_piano";
}

export function isInstrumentCompatible(
  kind: VoiceKind,
  instrument: InstrumentId,
): boolean {
  return instrumentDefinition(instrument).voiceKind === kind;
}

export type InstrumentPitchClass =
  | "usual"
  | "extended"
  | "unplayable";

export type InstrumentRangeAssessmentFit =
  | "empty"
  | "usual"
  | "extended"
  | "unplayable";

export interface InstrumentRangeAssessment {
  readonly fit: InstrumentRangeAssessmentFit;
  readonly usual: number;
  readonly extended: number;
  readonly unplayable: number;
  readonly usualRange: InstrumentRange;
  readonly playableRange: InstrumentRange;
}

export function classifyInstrumentPitch(
  pitch: number,
  instrument: InstrumentId,
): InstrumentPitchClass {
  const definition = instrumentDefinition(instrument);

  if (
    !Number.isFinite(pitch)
    || pitch < definition.playableRange.min
    || pitch > definition.playableRange.max
  ) {
    return "unplayable";
  }

  if (
    pitch >= definition.usualRange.min
    && pitch <= definition.usualRange.max
  ) {
    return "usual";
  }

  return "extended";
}

export function isInstrumentPitchPlayable(
  pitch: number,
  instrument: InstrumentId,
): boolean {
  return classifyInstrumentPitch(
    pitch,
    instrument,
  ) !== "unplayable";
}

export function assessInstrumentRange(
  pitches: readonly number[],
  instrument: InstrumentId,
): InstrumentRangeAssessment {
  const definition = instrumentDefinition(instrument);

  let usual = 0;
  let extended = 0;
  let unplayable = 0;

  for (const pitch of pitches) {
    const classification =
      classifyInstrumentPitch(pitch, instrument);

    if (classification === "usual") usual += 1;
    if (classification === "extended") extended += 1;
    if (classification === "unplayable") unplayable += 1;
  }

  const fit: InstrumentRangeAssessmentFit =
    pitches.length === 0
      ? "empty"
      : unplayable > 0
        ? "unplayable"
        : extended > 0
          ? "extended"
          : "usual";

  return {
    fit,
    usual,
    extended,
    unplayable,
    usualRange: definition.usualRange,
    playableRange: definition.playableRange,
  };
}

/**
 * Legacy assessment used by the current warning UI.
 *
 * Until Patch B migrates presentation, "inside" means inside usualRange
 * and both extended/unplayable pitches count as outside.
 */
export type RangeFit =
  | "empty"
  | "inside"
  | "partial"
  | "outside";

export function instrumentRangeFit(
  pitches: readonly number[],
  instrument: InstrumentId,
): {
  readonly fit: RangeFit;
  readonly inside: number;
  readonly outside: number;
  readonly range: InstrumentRange;
} {
  const range =
    instrumentDefinition(instrument).usualRange;

  const inside = pitches.filter(
    (pitch) =>
      pitch >= range.min
      && pitch <= range.max,
  ).length;

  const outside = pitches.length - inside;

  const fit: RangeFit =
    pitches.length === 0
      ? "empty"
      : inside === 0
        ? "outside"
        : outside > 0
          ? "partial"
          : "inside";

  return {
    fit,
    inside,
    outside,
    range,
  };
}