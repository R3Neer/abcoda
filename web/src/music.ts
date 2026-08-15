import ABCJS from "abcjs";
import { instrumentProgram, type InstrumentName } from "../../shared/score";
import type { VoiceKind } from "../../shared/abc-edit";

export type InstrumentRange = { min: number; max: number; label: string };
export type RangeFit = "empty" | "inside" | "partial" | "outside";

export const instrumentRanges: Record<InstrumentName, InstrumentRange> = {
  acoustic_grand_piano: { min: 21, max: 108, label: "A0–C8" },
  bright_acoustic_piano: { min: 21, max: 108, label: "A0–C8" },
  church_organ: { min: 36, max: 96, label: "C2–C7" },
  acoustic_guitar_nylon: { min: 40, max: 88, label: "E2–E6" },
  acoustic_bass: { min: 28, max: 67, label: "E1–G4" },
  violin: { min: 55, max: 105, label: "G3–A7" },
  viola: { min: 48, max: 88, label: "C3–E6" },
  cello: { min: 36, max: 84, label: "C2–C6" },
  contrabass: { min: 28, max: 67, label: "E1–G4 sounding" },
  string_ensemble_1: { min: 36, max: 96, label: "C2–C7" },
  choir_aahs: { min: 48, max: 84, label: "C3–C6" },
  trumpet: { min: 54, max: 86, label: "F♯3–D6 sounding" },
  trombone: { min: 40, max: 72, label: "E2–C5" },
  french_horn: { min: 35, max: 77, label: "B1–F5 sounding" },
  soprano_sax: { min: 56, max: 88, label: "A♭3–E6 sounding" },
  alto_sax: { min: 49, max: 80, label: "C♯3–A♭5 sounding" },
  tenor_sax: { min: 44, max: 75, label: "A♭2–E♭5 sounding" },
  oboe: { min: 58, max: 93, label: "B♭3–A6" },
  english_horn: { min: 52, max: 84, label: "E3–C6 sounding" },
  bassoon: { min: 34, max: 75, label: "B♭1–E♭5" },
  clarinet: { min: 52, max: 96, label: "E3–C7 sounding" },
  piccolo: { min: 74, max: 108, label: "D5–C8 sounding" },
  flute: { min: 60, max: 98, label: "C4–D7" },
  recorder: { min: 60, max: 96, label: "C4–C7" },
  percussion: { min: 35, max: 81, label: "GM percussion notes 35–81" },
};

export function instrumentLabel(instrument: InstrumentName): string {
  return instrument === "percussion" ? "Standard drum kit" : instrument.replaceAll("_", " ");
}

export function instrumentFromLabel(label: string): InstrumentName | undefined {
  const normalized = label.trim().toLocaleLowerCase();
  return (Object.keys(instrumentProgram) as InstrumentName[]).find((instrument) =>
    instrument === normalized || instrumentLabel(instrument).toLocaleLowerCase() === normalized,
  );
}

export function rangeFit(pitches: number[], instrument: InstrumentName): {
  fit: RangeFit;
  inside: number;
  outside: number;
  range: InstrumentRange;
} {
  const range = instrumentRanges[instrument];
  const inside = pitches.filter((pitch) => pitch >= range.min && pitch <= range.max).length;
  const outside = pitches.length - inside;
  const fit: RangeFit = pitches.length === 0 ? "empty" : inside === 0 ? "outside" : outside > 0 ? "partial" : "inside";
  return { fit, inside, outside, range };
}

export function voiceKindForInstrument(instrument: InstrumentName): VoiceKind {
  return instrument === "percussion" ? "unpitched_percussion" : "pitched";
}

export function instrumentForVoiceKind(kind: VoiceKind, current: InstrumentName): InstrumentName {
  if (kind === "unpitched_percussion") return "percussion";
  return current === "percussion" ? "acoustic_grand_piano" : current;
}

export function applyInstrumentPrograms(
  audio: ABCJS.AudioTracks,
  voiceIds: string[],
  instruments: Record<string, InstrumentName>,
): ABCJS.AudioTracks {
  audio.tracks.forEach((track, index) => {
    const voiceId = voiceIds[index] ?? voiceIds[0] ?? "default";
    const program = instrumentProgram[instruments[voiceId] ?? "acoustic_grand_piano"];
    track.forEach((event) => {
      if (event.cmd === "program" || event.cmd === "note") event.instrument = program;
    });
  });
  return audio;
}

export function playbackTuneForInstruments(
  tune: ABCJS.TuneObject,
  voiceIds: string[],
  instruments: Record<string, InstrumentName>,
): ABCJS.TuneObject {
  const playbackTune = Object.create(tune) as ABCJS.TuneObject;
  playbackTune.setUpAudio = (options) => applyInstrumentPrograms(
    tune.setUpAudio(options),
    voiceIds,
    instruments,
  );
  return playbackTune;
}

export function pitchesByVoice(
  tune: ABCJS.TuneObject,
  voiceIds: string[],
  qpm: number,
): Record<string, number[]> {
  const tracks = tune.setUpAudio({ qpm, chordsOff: true }).tracks;
  return Object.fromEntries(voiceIds.map((voiceId, index) => [
    voiceId,
    [...new Set((tracks[index] ?? [])
      .filter((event): event is ABCJS.AudioTrackNoteItem => event.cmd === "note")
      .map((event) => event.pitch))],
  ]));
}

export function applyInstruments(
  sequence: ABCJS.NoteMapTrack[],
  voiceIds: string[],
  instruments: Record<string, InstrumentName>,
  mutedVoices: Set<string>,
): ABCJS.NoteMapTrack[] {
  sequence.forEach((track, index) => {
    const voiceId = voiceIds[index] ?? voiceIds[0] ?? "default";
    const instrument = instruments[voiceId] ?? "acoustic_grand_piano";
    track.forEach((event) => {
      event.instrument = instrument;
      if (mutedVoices.has(voiceId)) event.volume = 0;
    });
  });
  return sequence;
}
