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

export function measureFromClasses(classes: string, fallback: number): number {
  const match = classes.match(/(?:^|\s)abcjs-m(\d+)(?:\s|$)/);
  return match ? Number(match[1]) + 1 : fallback + 1;
}

export function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
