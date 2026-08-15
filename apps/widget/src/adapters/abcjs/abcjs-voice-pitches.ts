import type ABCJS from "abcjs";

export function pitchesForVoices(
  tune: ABCJS.TuneObject,
  voiceIds: readonly string[],
  qpm: number,
): Readonly<Record<string, readonly number[]>> {
  const tracks = tune.setUpAudio({ qpm, chordsOff: true }).tracks;
  return Object.fromEntries(voiceIds.map((voiceId, index) => [
    voiceId,
    [...new Set((tracks[index] ?? [])
      .filter((event): event is ABCJS.AudioTrackNoteItem => event.cmd === "note")
      .map((event) => event.pitch))],
  ]));
}
