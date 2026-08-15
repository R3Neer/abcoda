import type { VoiceKind } from "@abcoda/domain";

export interface SynthPitchRange {
  readonly min: number;
  readonly max: number;
}

export interface AbcjsSynthCapabilityProfile {
  readonly abcjsVersion: "6.7.0";
  readonly soundFont: "FluidR3_GM";
  readonly melodicSamples: SynthPitchRange;
  readonly percussionSamples: SynthPitchRange;
  readonly safeMelodicPitch: number;
  readonly safePercussionPitch: number;
}

export const abcjsSynthCapability: AbcjsSynthCapabilityProfile = {
  abcjsVersion: "6.7.0",
  soundFont: "FluidR3_GM",
  melodicSamples: { min: 21, max: 108 },
  percussionSamples: { min: 28, max: 87 },
  safeMelodicPitch: 60,
  safePercussionPitch: 36,
};

function rangeForVoice(kind: VoiceKind): SynthPitchRange {
  return kind === "unpitched_percussion"
    ? abcjsSynthCapability.percussionSamples
    : abcjsSynthCapability.melodicSamples;
}

export function synthSupportsPitch(kind: VoiceKind, pitch: number): boolean {
  const range = rangeForVoice(kind);
  return Number.isInteger(pitch) && pitch >= range.min && pitch <= range.max;
}

export function safeSynthPitch(kind: VoiceKind): number {
  return kind === "unpitched_percussion"
    ? abcjsSynthCapability.safePercussionPitch
    : abcjsSynthCapability.safeMelodicPitch;
}
