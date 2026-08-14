import ABCJS from "abcjs";
import type { InstrumentName } from "../../shared/score";

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
