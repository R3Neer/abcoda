import type ABCJS from "abcjs";

export interface VoicePitchTarget {
  readonly element: SVGElement;
  readonly pitches: readonly number[];
}

export interface VoicePitchAnalysis {
  readonly pitchesByVoice: Readonly<Record<string, readonly number[]>>;
  readonly targetsByVoice: Readonly<Record<string, readonly VoicePitchTarget[]>>;
}

export function analyzeVoicePitches(
  tune: ABCJS.TuneObject,
  voiceIds: readonly string[],
  qpm: number,
): VoicePitchAnalysis {
  const tracks = tune.setUpAudio({ qpm, chordsOff: true }).tracks;
  const visualVoices = typeof tune.makeVoicesArray === "function"
    ? tune.makeVoicesArray()
    : [];

  const pitchesByVoice: Record<string, readonly number[]> = {};
  const targetsByVoice: Record<string, readonly VoicePitchTarget[]> = {};

  voiceIds.forEach((voiceId, index) => {
    const track = tracks[index] ?? [];
    const noteEvents = track.filter(
      (event): event is ABCJS.AudioTrackNoteItem => event.cmd === "note",
    );

    pitchesByVoice[voiceId] = [
      ...new Set(noteEvents.map((event) => event.pitch)),
    ];

    const pitchesByStartChar = new Map<number, Set<number>>();
    for (const event of noteEvents) {
      if (typeof event.startChar !== "number") continue;
      const pitches = pitchesByStartChar.get(event.startChar) ?? new Set<number>();
      pitches.add(event.pitch);
      pitchesByStartChar.set(event.startChar, pitches);
    }

    targetsByVoice[voiceId] = (visualVoices[index] ?? []).flatMap((selectable) => {
      const abcElement = selectable.absEl.abcelem;
      if (
        abcElement.el_type !== "note"
        || typeof abcElement.startChar !== "number"
      ) {
        return [];
      }

      const pitches = pitchesByStartChar.get(abcElement.startChar);
      if (!pitches || pitches.size === 0) return [];

      return [{
        element: selectable.svgEl,
        pitches: [...pitches],
      }];
    });
  });

  return { pitchesByVoice, targetsByVoice };
}

export function pitchesForVoices(
  tune: ABCJS.TuneObject,
  voiceIds: readonly string[],
  qpm: number,
): Readonly<Record<string, readonly number[]>> {
  return analyzeVoicePitches(tune, voiceIds, qpm).pitchesByVoice;
}
