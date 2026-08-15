import type { InstrumentId } from "@abcoda/domain";

export interface PlaybackActions {
  readonly togglePlayback: () => void;
  readonly rewind: () => void;
  readonly toggleLoop: () => void;
  readonly setTempo: (tempo: number) => void;
}

export interface VoiceMixActions {
  readonly setInstrument: (voiceId: string, instrument: InstrumentId) => void;
  readonly setMuted: (voiceId: string, muted: boolean) => void;
  readonly transposeVoice: (voiceId: string, semitones: number) => void;
}

export interface DraftActions {
  readonly edit: (draft: string) => void;
  readonly restoreVersion: (id: string) => void;
  readonly commit: (label: string) => boolean;
  readonly transpose: (semitones: number) => void;
}
