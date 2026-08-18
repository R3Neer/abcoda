import type { InstrumentId } from "./instruments";

export interface SingleStaffNotation {
  readonly kind: "fixed";
  readonly count: 1;
  readonly connection: "none";
  readonly clefs: readonly [string];
}

export interface GrandStaffNotation {
  readonly kind: "fixed";
  readonly count: 2;
  readonly connection: "brace";
  readonly clefs: readonly [string, string];
}

export interface VariableStaffNotation {
  readonly kind: "variable";
  readonly connection: "none" | "brace" | "bracket";
  readonly defaultClefs: readonly string[];
}

export type InstrumentStaffNotation =
  | SingleStaffNotation
  | GrandStaffNotation
  | VariableStaffNotation;

export interface InstrumentNotationPolicy {
  readonly name: string;
  readonly subname: string;
  readonly staves: InstrumentStaffNotation;
}

const single = (
  name: string,
  subname: string,
  clef: string,
): InstrumentNotationPolicy => ({
  name,
  subname,
  staves: { kind: "fixed", count: 1, connection: "none", clefs: [clef] },
});

const grandStaff = (
  name: string,
  subname: string,
): InstrumentNotationPolicy => ({
  name,
  subname,
  staves: {
    kind: "fixed",
    count: 2,
    connection: "brace",
    clefs: ["treble", "bass"],
  },
});

export const instrumentNotationCatalog: Readonly<Record<InstrumentId, InstrumentNotationPolicy>> = {
  acoustic_grand_piano: grandStaff("Piano", "Pno."),
  bright_acoustic_piano: grandStaff("Piano", "Pno."),
  church_organ: {
    name: "Organ",
    subname: "Org.",
    staves: {
      kind: "variable",
      connection: "brace",
      defaultClefs: ["treble", "bass", "bass"],
    },
  },
  acoustic_guitar_nylon: single("Guitar", "Gtr.", "treble"),
  acoustic_bass: single("Bass", "Bass", "bass"),
  violin: single("Violin", "Vln.", "treble"),
  viola: single("Viola", "Vla.", "alto"),
  cello: single("Cello", "Vc.", "bass"),
  contrabass: single("Double bass", "Db.", "bass"),
  string_ensemble_1: single("Strings", "Str.", "treble"),
  choir_aahs: single("Choir", "Ch.", "treble"),
  trumpet: single("Trumpet", "Tpt.", "treble"),
  trombone: single("Trombone", "Tbn.", "bass"),
  french_horn: single("Horn", "Hn.", "treble"),
  soprano_sax: single("Soprano saxophone", "S. sax.", "treble"),
  alto_sax: single("Alto saxophone", "A. sax.", "treble"),
  tenor_sax: single("Tenor saxophone", "T. sax.", "treble"),
  oboe: single("Oboe", "Ob.", "treble"),
  english_horn: single("English horn", "E. hn.", "treble"),
  bassoon: single("Bassoon", "Bsn.", "bass"),
  clarinet: single("Clarinet in B♭", "Cl.", "treble"),
  piccolo: single("Piccolo", "Picc.", "treble"),
  flute: single("Flute", "Fl.", "treble"),
  recorder: single("Recorder", "Rec.", "treble"),
  standard_drum_kit: single("Drum set", "Dr.", "perc"),
};

export function instrumentNotation(id: InstrumentId): InstrumentNotationPolicy {
  return instrumentNotationCatalog[id];
}
