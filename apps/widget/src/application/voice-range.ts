import { instrumentRangeFit } from "../../../../packages/domain/src/index";
import type { VoiceMixSnapshot } from "./voice-mix";

export interface VoiceRangeAssessment {
  readonly voiceId: string;
  readonly fit: "empty" | "inside" | "partial" | "outside";
  readonly message?: string;
}

export function assessVoiceRanges(
  mix: VoiceMixSnapshot,
  pitchesByVoice: Readonly<Record<string, readonly number[]>>,
): readonly VoiceRangeAssessment[] {
  return mix.voices.map((voice) => {
    const pitches = pitchesByVoice[voice.id] ?? [];
    const result = instrumentRangeFit(pitches, voice.instrument);
    const noteWord = result.outside === 1 ? "note" : "notes";
    const message = result.fit === "outside"
      ? `All ${result.outside} notes are outside the usual ${result.range.label} range.`
      : result.fit === "partial"
        ? `${result.outside} ${noteWord} outside the usual ${result.range.label} range.`
        : undefined;
    return { voiceId: voice.id, fit: result.fit, ...(message ? { message } : {}) };
  });
}
