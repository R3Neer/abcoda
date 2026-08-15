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
export type PitchedInstrumentId = Exclude<InstrumentId, "standard_drum_kit">;

export interface PitchRange {
  readonly min: number;
  readonly max: number;
  readonly label: string;
}

export interface PitchedInstrumentDefinition {
  readonly id: PitchedInstrumentId;
  readonly label: string;
  readonly voiceKind: "pitched";
  readonly midiProgram: number;
  readonly usualRange: PitchRange;
  readonly playableRange: PitchRange;
}

export interface PercussionInstrumentDefinition {
  readonly id: "standard_drum_kit";
  readonly label: string;
  readonly voiceKind: "unpitched_percussion";
  readonly midiProgram?: undefined;
  readonly noteRange: PitchRange;
}

export type InstrumentDefinition =
  | PitchedInstrumentDefinition
  | PercussionInstrumentDefinition;

const pitchRange = (
  min: number,
  max: number,
  label: string,
): PitchRange => ({ min, max, label });

const pitched = (
  id: PitchedInstrumentId,
  label: string,
  midiProgram: number,
  usualRange: PitchRange,
  playableRange: PitchRange,
): PitchedInstrumentDefinition => {
  if (
    usualRange.min < playableRange.min
    || usualRange.max > playableRange.max
  ) {
    throw new Error(
      `Instrument ${id} has a usual range outside its playable range.`,
    );
  }

  return {
    id,
    label,
    voiceKind: "pitched",
    midiProgram,
    usualRange,
    playableRange,
  };
};

// The former single catalog range becomes the hard musical/product boundary.
// The narrower usual range is the comfortable/default writing range. Neither
// range describes SoundFont sample coverage; that belongs to the audio adapter.
export const instrumentCatalog: readonly InstrumentDefinition[] = [
  pitched(
    "acoustic_grand_piano",
    "Acoustic grand piano",
    0,
    pitchRange(21, 108, "A0–C8"),
    pitchRange(21, 108, "A0–C8"),
  ),
  pitched(
    "bright_acoustic_piano",
    "Bright acoustic piano",
    1,
    pitchRange(21, 108, "A0–C8"),
    pitchRange(21, 108, "A0–C8"),
  ),
  pitched(
    "church_organ",
    "Church organ",
    19,
    pitchRange(36, 96, "C2–C7"),
    pitchRange(36, 96, "C2–C7"),
  ),
  pitched(
    "acoustic_guitar_nylon",
    "Nylon-string guitar",
    24,
    pitchRange(40, 83, "E2–B5"),
    pitchRange(40, 88, "E2–E6"),
  ),
  pitched(
    "acoustic_bass",
    "Acoustic bass",
    32,
    pitchRange(28, 62, "E1–D4"),
    pitchRange(28, 67, "E1–G4"),
  ),
  pitched(
    "violin",
    "Violin",
    40,
    pitchRange(55, 100, "G3–E7"),
    pitchRange(55, 105, "G3–A7"),
  ),
  pitched(
    "viola",
    "Viola",
    41,
    pitchRange(48, 84, "C3–C6"),
    pitchRange(48, 88, "C3–E6"),
  ),
  pitched(
    "cello",
    "Cello",
    42,
    pitchRange(36, 81, "C2–A5"),
    pitchRange(36, 84, "C2–C6"),
  ),
  pitched(
    "contrabass",
    "Contrabass",
    43,
    pitchRange(28, 62, "E1–D4 sounding"),
    pitchRange(28, 67, "E1–G4 sounding"),
  ),
  pitched(
    "string_ensemble_1",
    "String ensemble",
    48,
    pitchRange(36, 84, "C2–C6"),
    pitchRange(36, 96, "C2–C7"),
  ),
  pitched(
    "choir_aahs",
    "Choir aahs",
    52,
    pitchRange(48, 84, "C3–C6"),
    pitchRange(48, 84, "C3–C6"),
  ),
  pitched(
    "trumpet",
    "Trumpet",
    56,
    pitchRange(54, 84, "F♯3–C6 sounding"),
    pitchRange(54, 86, "F♯3–D6 sounding"),
  ),
  pitched(
    "trombone",
    "Trombone",
    57,
    pitchRange(40, 70, "E2–B♭4"),
    pitchRange(40, 72, "E2–C5"),
  ),
  pitched(
    "french_horn",
    "French horn",
    60,
    pitchRange(36, 77, "C2–F5 sounding"),
    pitchRange(35, 77, "B1–F5 sounding"),
  ),
  pitched(
    "soprano_sax",
    "Soprano saxophone",
    64,
    pitchRange(58, 86, "B♭3–D6 sounding"),
    pitchRange(56, 88, "A♭3–E6 sounding"),
  ),
  pitched(
    "alto_sax",
    "Alto saxophone",
    65,
    pitchRange(50, 78, "D3–F♯5 sounding"),
    pitchRange(49, 80, "C♯3–A♭5 sounding"),
  ),
  pitched(
    "tenor_sax",
    "Tenor saxophone",
    66,
    pitchRange(45, 74, "A2–D5 sounding"),
    pitchRange(44, 75, "A♭2–E♭5 sounding"),
  ),
  pitched(
    "oboe",
    "Oboe",
    68,
    pitchRange(58, 91, "B♭3–G6"),
    pitchRange(58, 93, "B♭3–A6"),
  ),
  pitched(
    "english_horn",
    "English horn",
    69,
    pitchRange(52, 82, "E3–B♭5 sounding"),
    pitchRange(52, 84, "E3–C6 sounding"),
  ),
  pitched(
    "bassoon",
    "Bassoon",
    70,
    pitchRange(34, 74, "B♭1–D5"),
    pitchRange(34, 75, "B♭1–E♭5"),
  ),
  pitched(
    "clarinet",
    "Clarinet",
    71,
    pitchRange(52, 91, "E3–G6 sounding"),
    pitchRange(52, 96, "E3–C7 sounding"),
  ),
  pitched(
    "piccolo",
    "Piccolo",
    72,
    pitchRange(74, 108, "D5–C8 sounding"),
    pitchRange(74, 108, "D5–C8 sounding"),
  ),
  pitched(
    "flute",
    "Flute",
    73,
    pitchRange(60, 96, "C4–C7"),
    pitchRange(60, 98, "C4–D7"),
  ),
  pitched(
    "recorder",
    "Recorder",
    74,
    pitchRange(60, 93, "C4–A6"),
    pitchRange(60, 96, "C4–C7"),
  ),
  {
    id: "standard_drum_kit",
    label: "Standard drum kit",
    voiceKind: "unpitched_percussion",
    noteRange: pitchRange(35, 81, "GM percussion notes 35–81"),
  },
] as const;

const definitions = new Map(
  instrumentCatalog.map((instrument) => [instrument.id, instrument]),
);

export function instrumentDefinition(id: InstrumentId): InstrumentDefinition {
  const definition = definitions.get(id);
  if (!definition) throw new Error(`Unknown instrument ${id}.`);
  return definition;
}

export function instrumentsForVoice(kind: VoiceKind): readonly InstrumentDefinition[] {
  return instrumentCatalog.filter((instrument) => instrument.voiceKind === kind);
}

export function defaultInstrument(kind: VoiceKind): InstrumentId {
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

export type PitchRangeClassification =
  | "usual"
  | "extended"
  | "unplayable";

export type InstrumentRangeStatus = "empty" | PitchRangeClassification;

export interface InstrumentRangeAssessment {
  readonly status: InstrumentRangeStatus;
  readonly usual: number;
  readonly extended: number;
  readonly unplayable: number;
  readonly usualRange: PitchRange;
  readonly playableRange: PitchRange;
}

export function classifyInstrumentPitch(
  pitch: number,
  instrument: InstrumentId,
): PitchRangeClassification {
  const definition = instrumentDefinition(instrument);
  if (definition.voiceKind !== "pitched") {
    throw new Error(
      `Instrument ${instrument} does not use melodic range classification.`,
    );
  }

  if (
    pitch < definition.playableRange.min
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

export function assessInstrumentPitches(
  pitches: readonly number[],
  instrument: InstrumentId,
): InstrumentRangeAssessment {
  const definition = instrumentDefinition(instrument);
  if (definition.voiceKind !== "pitched") {
    throw new Error(
      `Instrument ${instrument} does not use melodic range classification.`,
    );
  }

  let usual = 0;
  let extended = 0;
  let unplayable = 0;

  for (const pitch of pitches) {
    const classification = classifyInstrumentPitch(pitch, instrument);
    if (classification === "usual") usual += 1;
    if (classification === "extended") extended += 1;
    if (classification === "unplayable") unplayable += 1;
  }

  const status: InstrumentRangeStatus = pitches.length === 0
    ? "empty"
    : unplayable > 0
      ? "unplayable"
      : extended > 0
        ? "extended"
        : "usual";

  return {
    status,
    usual,
    extended,
    unplayable,
    usualRange: definition.usualRange,
    playableRange: definition.playableRange,
  };
}
