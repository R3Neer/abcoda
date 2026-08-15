import {
  assessInstrumentPitches,
  type InstrumentRangeStatus,
} from "../../../../packages/domain/src/index";
import type { VoiceMixSnapshot } from "./voice-mix";

export type VoiceRangeStatus = InstrumentRangeStatus | "not_applicable";

export interface VoiceRangeAssessment {
  readonly voiceId: string;
  readonly status: VoiceRangeStatus;
  readonly message?: string;
}

export function assessVoiceRanges(
  mix: VoiceMixSnapshot,
  pitchesByVoice: Readonly<Record<string, readonly number[]>>,
): readonly VoiceRangeAssessment[] {
  return mix.voices.map((voice) => {
    if (voice.kind !== "pitched") {
      return {
        voiceId: voice.id,
        status: "not_applicable",
      };
    }

    const result = assessInstrumentPitches(
      pitchesByVoice[voice.id] ?? [],
      voice.instrument,
    );

    const message = result.status === "extended"
      ? `Some notes are outside the usual ${result.usualRange.label} range but remain within the playable ${result.playableRange.label} range.`
      : result.status === "unplayable"
        ? `Some notes are outside the usual ${result.usualRange.label} range and exceed the playable ${result.playableRange.label} range. Notes outside the playable range are shown in red and played silently.`
        : undefined;

    return {
      voiceId: voice.id,
      status: result.status,
      ...(message ? { message } : {}),
    };
  });
}
