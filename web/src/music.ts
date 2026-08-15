import ABCJS from "abcjs";
import type { InstrumentName } from "../../shared/score";
import type { VoiceKind } from "../../shared/abc-edit";

export function voiceKindForInstrument(instrument: InstrumentName): VoiceKind {
  return instrument === "percussion" ? "unpitched_percussion" : "pitched";
}

export function instrumentForVoiceKind(kind: VoiceKind, current: InstrumentName): InstrumentName {
  if (kind === "unpitched_percussion") return "percussion";
  return current === "percussion" ? "acoustic_grand_piano" : current;
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
