import type ABCJS from "abcjs";

export interface VoicePitchTarget {
  readonly element: SVGElement;
  readonly pitches: readonly number[];
}

export interface VoicePitchAnalysis {
  readonly pitchesByVoice: Readonly<Record<string, readonly number[]>>;
  readonly targetsByVoice: Readonly<Record<string, readonly VoicePitchTarget[]>>;
}

type TuneWithSelectables = ABCJS.TuneObject & {
  readonly engraver?: {
    readonly selectables?: readonly ABCJS.Selectable[];
  };
};

export function analyzeVoicePitches(
  tune: ABCJS.TuneObject,
  voiceIds: readonly string[],
  qpm: number,
): VoicePitchAnalysis {
  const tracks = tune.setUpAudio({ qpm, chordsOff: true }).tracks;
  const pitchesByVoice: Record<string, readonly number[]> = {};
  const targetsByVoice: Record<string, VoicePitchTarget[]> = {};
  const pitchesByVoiceAndStart = new Map<string, Map<number, Set<number>>>();

  voiceIds.forEach((voiceId, index) => {
    const track = tracks[index] ?? [];
    const noteEvents = track.filter(
      (event): event is ABCJS.AudioTrackNoteItem => event.cmd === "note",
    );

    pitchesByVoice[voiceId] = [
      ...new Set(noteEvents.map((event) => event.pitch)),
    ];
    targetsByVoice[voiceId] = [];

    const pitchesByStartChar = new Map<number, Set<number>>();
    for (const event of noteEvents) {
      if (typeof event.startChar !== "number") continue;
      const pitches = pitchesByStartChar.get(event.startChar) ?? new Set<number>();
      pitches.add(event.pitch);
      pitchesByStartChar.set(event.startChar, pitches);
    }
    pitchesByVoiceAndStart.set(voiceId, pitchesByStartChar);
  });

  const selectables = (tune as TuneWithSelectables).engraver?.selectables ?? [];
  for (const selectable of selectables) {
    const abcElement = selectable.absEl.abcelem;
    if (
      abcElement.el_type !== "note"
      || typeof abcElement.startChar !== "number"
    ) {
      continue;
    }

    const voiceIndex = voiceIndexFromClass(
      selectable.svgEl.getAttribute("class") ?? "",
    );
    const voiceId = voiceIndex === undefined ? undefined : voiceIds[voiceIndex];
    if (!voiceId) continue;

    const pitches = pitchesByVoiceAndStart.get(voiceId)?.get(abcElement.startChar);
    if (!pitches || pitches.size === 0) continue;

    targetsByVoice[voiceId]?.push({
      element: selectable.svgEl,
      pitches: [...pitches],
    });
  }

  return { pitchesByVoice, targetsByVoice };
}

export function pitchesForVoices(
  tune: ABCJS.TuneObject,
  voiceIds: readonly string[],
  qpm: number,
): Readonly<Record<string, readonly number[]>> {
  return analyzeVoicePitches(tune, voiceIds, qpm).pitchesByVoice;
}

function voiceIndexFromClass(className: string): number | undefined {
  const match = className.match(/(?:^|\s)abcjs-v(\d+)(?:\s|$)/);
  if (!match) return undefined;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 ? index : undefined;
}
