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

export interface BoundedRangePolicy {
  readonly kind: "bounded";
  readonly usualRange: PitchRange;
  readonly playableRange: PitchRange;
}

export interface UnboundedRangePolicy {
  readonly kind: "unbounded";
}

export interface PercussionRangePolicy {
  readonly kind: "percussion";
  readonly noteRange: PitchRange;
}

export type PitchedRangePolicy = BoundedRangePolicy | UnboundedRangePolicy;
export type InstrumentRangePolicy = PitchedRangePolicy | PercussionRangePolicy;

export interface PitchedInstrumentDefinition {
  readonly id: PitchedInstrumentId;
  readonly label: string;
  readonly voiceKind: "pitched";
  readonly midiProgram: number;
  readonly rangePolicy: PitchedRangePolicy;
}

export interface PercussionInstrumentDefinition {
  readonly id: "standard_drum_kit";
  readonly label: string;
  readonly voiceKind: "unpitched_percussion";
  readonly midiProgram?: undefined;
  readonly rangePolicy: PercussionRangePolicy;
}

export type InstrumentDefinition =
  | PitchedInstrumentDefinition
  | PercussionInstrumentDefinition;

const pitchRange = (
  min: number,
  max: number,
  label: string,
): PitchRange => ({ min, max, label });

const bounded = (
  usualRange: PitchRange,
  playableRange: PitchRange,
): BoundedRangePolicy => {
  if (
    usualRange.min < playableRange.min
    || usualRange.max > playableRange.max
  ) {
    throw new Error("Instrument usual range must be contained in its playable range.");
  }

  return { kind: "bounded", usualRange, playableRange };
};

const pitched = (
  id: PitchedInstrumentId,
  label: string,
  midiProgram: number,
  rangePolicy: PitchedRangePolicy,
): PitchedInstrumentDefinition => ({
  id,
  label,
  voiceKind: "pitched",
  midiProgram,
  rangePolicy,
});

const unbounded: UnboundedRangePolicy = { kind: "unbounded" };

// All bounded ranges use sounding MIDI pitch. `usualRange` is a practical,
// idiomatic writing range; `playableRange` is a conservative hard envelope.
// Generic/synthetic presets whose physical compass is not well-defined use an
// unbounded policy instead of fabricated organological limits. SoundFont sample
// coverage remains a separate adapter concern.
export const instrumentCatalog: readonly InstrumentDefinition[] = [
  pitched(
    "acoustic_grand_piano",
    "Acoustic grand piano",
    0,
    bounded(
      pitchRange(21, 108, "A0–C8"),
      pitchRange(21, 108, "A0–C8"),
    ),
  ),
  pitched(
    "bright_acoustic_piano",
    "Bright acoustic piano",
    1,
    bounded(
      pitchRange(21, 108, "A0–C8"),
      pitchRange(21, 108, "A0–C8"),
    ),
  ),
  pitched("church_organ", "Church organ", 19, unbounded),
  pitched(
    "acoustic_guitar_nylon",
    "Nylon-string guitar",
    24,
    bounded(
      pitchRange(40, 83, "E2–B5"),
      pitchRange(40, 84, "E2–C6"),
    ),
  ),
  pitched(
    "acoustic_bass",
    "Acoustic bass",
    32,
    bounded(
      pitchRange(28, 62, "E1–D4"),
      pitchRange(28, 67, "E1–G4"),
    ),
  ),
  pitched(
    "violin",
    "Violin",
    40,
    bounded(
      pitchRange(55, 100, "G3–E7"),
      pitchRange(55, 105, "G3–A7"),
    ),
  ),
  pitched(
    "viola",
    "Viola",
    41,
    bounded(
      pitchRange(48, 88, "C3–E6"),
      pitchRange(48, 93, "C3–A6"),
    ),
  ),
  pitched(
    "cello",
    "Cello",
    42,
    bounded(
      pitchRange(36, 81, "C2–A5"),
      pitchRange(36, 84, "C2–C6"),
    ),
  ),
  pitched(
    "contrabass",
    "Contrabass",
    43,
    bounded(
      pitchRange(28, 62, "E1–D4 sounding"),
      pitchRange(23, 67, "B0–G4 sounding"),
    ),
  ),
  pitched("string_ensemble_1", "String ensemble", 48, unbounded),
  pitched("choir_aahs", "Choir aahs", 52, unbounded),
  pitched(
    "trumpet",
    "Trumpet",
    56,
    bounded(
      pitchRange(54, 84, "F♯3–C6 sounding"),
      pitchRange(54, 89, "F♯3–F6 sounding"),
    ),
  ),
  pitched(
    "trombone",
    "Trombone",
    57,
    bounded(
      pitchRange(40, 70, "E2–B♭4"),
      pitchRange(40, 77, "E2–F5"),
    ),
  ),
  pitched(
    "french_horn",
    "French horn",
    60,
    bounded(
      pitchRange(35, 70, "B1–B♭4 sounding"),
      pitchRange(35, 77, "B1–F5 sounding"),
    ),
  ),
  pitched(
    "soprano_sax",
    "Soprano saxophone",
    64,
    bounded(
      pitchRange(60, 82, "C4–B♭5 sounding"),
      pitchRange(56, 88, "A♭3–E6 sounding"),
    ),
  ),
  pitched(
    "alto_sax",
    "Alto saxophone",
    65,
    bounded(
      pitchRange(53, 75, "F3–E♭5 sounding"),
      pitchRange(49, 81, "D♭3–A5 sounding"),
    ),
  ),
  pitched(
    "tenor_sax",
    "Tenor saxophone",
    66,
    bounded(
      pitchRange(48, 70, "C3–B♭4 sounding"),
      pitchRange(44, 76, "A♭2–E5 sounding"),
    ),
  ),
  pitched(
    "oboe",
    "Oboe",
    68,
    bounded(
      pitchRange(58, 91, "B♭3–G6"),
      pitchRange(58, 93, "B♭3–A6"),
    ),
  ),
  pitched(
    "english_horn",
    "English horn",
    69,
    bounded(
      pitchRange(52, 81, "E3–A5 sounding"),
      pitchRange(52, 83, "E3–B5 sounding"),
    ),
  ),
  pitched(
    "bassoon",
    "Bassoon",
    70,
    bounded(
      pitchRange(34, 75, "B♭1–E♭5"),
      pitchRange(34, 77, "B♭1–F5"),
    ),
  ),
  pitched(
    "clarinet",
    "Clarinet in B♭",
    71,
    bounded(
      pitchRange(50, 91, "D3–G6 sounding"),
      pitchRange(50, 94, "D3–B♭6 sounding"),
    ),
  ),
  pitched(
    "piccolo",
    "Piccolo",
    72,
    bounded(
      pitchRange(74, 108, "D5–C8 sounding"),
      pitchRange(74, 108, "D5–C8 sounding"),
    ),
  ),
  pitched(
    "flute",
    "Flute",
    73,
    bounded(
      pitchRange(59, 98, "B3–D7"),
      pitchRange(59, 101, "B3–F7"),
    ),
  ),
  pitched("recorder", "Recorder (generic)", 74, unbounded),
  {
    id: "standard_drum_kit",
    label: "Standard drum kit",
    voiceKind: "unpitched_percussion",
    rangePolicy: {
      kind: "percussion",
      noteRange: pitchRange(35, 81, "GM percussion notes 35–81"),
    },
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
  | "unplayable"
  | "unbounded";

export type InstrumentRangeStatus = "empty" | PitchRangeClassification;

export interface BoundedInstrumentRangeAssessment {
  readonly policy: "bounded";
  readonly status: "empty" | "usual" | "extended" | "unplayable";
  readonly usual: number;
  readonly extended: number;
  readonly unplayable: number;
  readonly usualRange: PitchRange;
  readonly playableRange: PitchRange;
}

export interface UnboundedInstrumentRangeAssessment {
  readonly policy: "unbounded";
  readonly status: "empty" | "unbounded";
  readonly usual: 0;
  readonly extended: 0;
  readonly unplayable: 0;
}

export type InstrumentRangeAssessment =
  | BoundedInstrumentRangeAssessment
  | UnboundedInstrumentRangeAssessment;

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

  const policy = definition.rangePolicy;
  if (policy.kind === "unbounded") return "unbounded";

  if (
    pitch < policy.playableRange.min
    || pitch > policy.playableRange.max
  ) {
    return "unplayable";
  }

  if (
    pitch >= policy.usualRange.min
    && pitch <= policy.usualRange.max
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

  const policy = definition.rangePolicy;
  if (policy.kind === "unbounded") {
    return {
      policy: "unbounded",
      status: pitches.length === 0 ? "empty" : "unbounded",
      usual: 0,
      extended: 0,
      unplayable: 0,
    };
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

  const status: BoundedInstrumentRangeAssessment["status"] = pitches.length === 0
    ? "empty"
    : unplayable > 0
      ? "unplayable"
      : extended > 0
        ? "extended"
        : "usual";

  return {
    policy: "bounded",
    status,
    usual,
    extended,
    unplayable,
    usualRange: policy.usualRange,
    playableRange: policy.playableRange,
  };
}
