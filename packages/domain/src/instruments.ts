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

export interface InstrumentDefinition {
  readonly id: InstrumentId;
  readonly label: string;
  readonly voiceKind: VoiceKind;
  readonly midiProgram?: number;
  readonly range: {
    readonly min: number;
    readonly max: number;
    readonly label: string;
  };
}

const pitched = (
  id: Exclude<InstrumentId, "standard_drum_kit">,
  label: string,
  midiProgram: number,
  min: number,
  max: number,
  rangeLabel: string,
): InstrumentDefinition => ({
  id,
  label,
  voiceKind: "pitched",
  midiProgram,
  range: { min, max, label: rangeLabel },
});

export const instrumentCatalog: readonly InstrumentDefinition[] = [
  pitched("acoustic_grand_piano", "Acoustic grand piano", 0, 21, 108, "A0–C8"),
  pitched("bright_acoustic_piano", "Bright acoustic piano", 1, 21, 108, "A0–C8"),
  pitched("church_organ", "Church organ", 19, 36, 96, "C2–C7"),
  pitched("acoustic_guitar_nylon", "Nylon-string guitar", 24, 40, 88, "E2–E6"),
  pitched("acoustic_bass", "Acoustic bass", 32, 28, 67, "E1–G4"),
  pitched("violin", "Violin", 40, 55, 105, "G3–A7"),
  pitched("viola", "Viola", 41, 48, 88, "C3–E6"),
  pitched("cello", "Cello", 42, 36, 84, "C2–C6"),
  pitched("contrabass", "Contrabass", 43, 28, 67, "E1–G4 sounding"),
  pitched("string_ensemble_1", "String ensemble", 48, 36, 96, "C2–C7"),
  pitched("choir_aahs", "Choir aahs", 52, 48, 84, "C3–C6"),
  pitched("trumpet", "Trumpet", 56, 54, 86, "F♯3–D6 sounding"),
  pitched("trombone", "Trombone", 57, 40, 72, "E2–C5"),
  pitched("french_horn", "French horn", 60, 35, 77, "B1–F5 sounding"),
  pitched("soprano_sax", "Soprano saxophone", 64, 56, 88, "A♭3–E6 sounding"),
  pitched("alto_sax", "Alto saxophone", 65, 49, 80, "C♯3–A♭5 sounding"),
  pitched("tenor_sax", "Tenor saxophone", 66, 44, 75, "A♭2–E♭5 sounding"),
  pitched("oboe", "Oboe", 68, 58, 93, "B♭3–A6"),
  pitched("english_horn", "English horn", 69, 52, 84, "E3–C6 sounding"),
  pitched("bassoon", "Bassoon", 70, 34, 75, "B♭1–E♭5"),
  pitched("clarinet", "Clarinet", 71, 52, 96, "E3–C7 sounding"),
  pitched("piccolo", "Piccolo", 72, 74, 108, "D5–C8 sounding"),
  pitched("flute", "Flute", 73, 60, 98, "C4–D7"),
  pitched("recorder", "Recorder", 74, 60, 96, "C4–C7"),
  {
    id: "standard_drum_kit",
    label: "Standard drum kit",
    voiceKind: "unpitched_percussion",
    range: { min: 35, max: 81, label: "GM percussion notes 35–81" },
  },
] as const;

const definitions = new Map(instrumentCatalog.map((instrument) => [instrument.id, instrument]));

export function instrumentDefinition(id: InstrumentId): InstrumentDefinition {
  const definition = definitions.get(id);
  if (!definition) throw new Error(`Unknown instrument ${id}.`);
  return definition;
}

export function instrumentsForVoice(kind: VoiceKind): readonly InstrumentDefinition[] {
  return instrumentCatalog.filter((instrument) => instrument.voiceKind === kind);
}

export function defaultInstrument(kind: VoiceKind): InstrumentId {
  return kind === "unpitched_percussion" ? "standard_drum_kit" : "acoustic_grand_piano";
}

export function isInstrumentCompatible(kind: VoiceKind, instrument: InstrumentId): boolean {
  return instrumentDefinition(instrument).voiceKind === kind;
}

export type RangeFit = "empty" | "inside" | "partial" | "outside";

export function instrumentRangeFit(pitches: readonly number[], instrument: InstrumentId): {
  readonly fit: RangeFit;
  readonly inside: number;
  readonly outside: number;
  readonly range: InstrumentDefinition["range"];
} {
  const range = instrumentDefinition(instrument).range;
  const inside = pitches.filter((pitch) => pitch >= range.min && pitch <= range.max).length;
  const outside = pitches.length - inside;
  const fit: RangeFit = pitches.length === 0
    ? "empty"
    : inside === 0
      ? "outside"
      : outside > 0
        ? "partial"
        : "inside";
  return { fit, inside, outside, range };
}
