import type { InstrumentId, VoiceKind } from "./instruments";

export type Brand<Value, Name extends string> = Value & {
  readonly __brand: Name;
};

export type TuneId = Brand<string, "TuneId">;
export type MelodyId = TuneId;
export type VoiceId = Brand<string, "VoiceId">;
export type MeasureId = Brand<string, "MeasureId">;
export type EventId = Brand<string, "EventId">;
export type RevisionId = Brand<number, "RevisionId">;
export type QuarterNoteBpm = Brand<number, "QuarterNoteBpm">;

export interface SourcePosition {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

export interface SourceRange {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export interface RationalDuration {
  readonly numerator: number;
  readonly denominator: number;
}

export type MusicalEventKind =
  | "note"
  | "rest"
  | "chord"
  | "tuplet"
  | "inline_field"
  | "annotation"
  | "decoration"
  | "opaque";

export interface MusicalEvent {
  readonly id: EventId;
  readonly kind: MusicalEventKind;
  readonly lexeme: string;
  readonly source: SourceRange;
  readonly duration?: RationalDuration;
}

export interface Measure {
  readonly id: MeasureId;
  readonly number: number;
  readonly events: readonly MusicalEvent[];
  readonly source: SourceRange;
  readonly expectedDuration?: RationalDuration;
  readonly actualDuration?: RationalDuration;
}

export interface ScoreVoiceDocument {
  readonly id: VoiceId;
  readonly kind: VoiceKind;
  readonly clef?: string;
  readonly transpositionSemitones?: number;
  readonly measures: readonly Measure[];
}

export interface ScoreHeader {
  readonly title?: string;
  readonly meter?: string;
  readonly defaultNoteLength?: RationalDuration;
  readonly key?: string;
  readonly tempo?: {
    readonly beatUnit: "quarter";
    readonly bpm: QuarterNoteBpm;
  };
}

export interface ScoreDirective {
  readonly name: string;
  readonly value: string;
  readonly source: SourceRange;
}

export interface AbcSource {
  readonly format: "abc";
  readonly text: string;
}

/** Rich, immutable aggregate used by validation and score operations. */
export interface ScoreDocument {
  readonly tuneId: TuneId;
  readonly header: ScoreHeader;
  readonly voices: readonly ScoreVoiceDocument[];
  readonly directives: readonly ScoreDirective[];
  readonly source: AbcSource;
}

/** Compact projection exchanged with MCP hosts and reconstructed from ABC. */
export interface ScoreSnapshotDocument {
  readonly tuneId: TuneId;
  readonly title?: string;
  readonly meter?: string;
  readonly key?: string;
  readonly tempo?: {
    readonly beatUnit: "quarter";
    readonly bpm: QuarterNoteBpm;
  };
  readonly voices: readonly ScoreVoiceSummary[];
  readonly source: AbcSource;
}

export interface ScoreVoiceSummary {
  readonly id: VoiceId;
  readonly kind: VoiceKind;
}

export interface ScoreSnapshot {
  readonly schemaVersion: 2;
  readonly revision: RevisionId;
  readonly document: ScoreSnapshotDocument;
  readonly diagnostics: readonly Diagnostic[];
}

export type DiagnosticSeverity = "info" | "warning" | "error";

export type DiagnosticCode =
  | "ABC_TUNE_REFERENCE_MISSING"
  | "ABC_MULTIPLE_TUNES_UNSUPPORTED"
  | "ABC_TUNE_REFERENCE_INVALID"
  | "ABC_VOICE_ID_INVALID"
  | "ABC_SOURCE_EMPTY"
  | "ABC_TRANSPOSITION_FAILED"
  | "ABC_MEASURE_DURATION_MISMATCH"
  | "ABC_VOICE_MEASURE_COUNT_MISMATCH"
  | "UNSUPPORTED_ABC_FEATURE";

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly range?: SourceRange;
  readonly suggestedCorrection?: string;
}

export interface PlaybackProfile {
  readonly tempo?: QuarterNoteBpm;
  readonly instruments: Readonly<Partial<Record<VoiceId, InstrumentId>>>;
  readonly mutedVoices: readonly VoiceId[];
  readonly loop: boolean;
}

export type ScoreOperation =
  | {
      readonly kind: "transpose";
      readonly semitones: number;
    }
  | {
      readonly kind: "assign_instrument";
      readonly voiceId: VoiceId;
      readonly instrumentId: InstrumentId;
    }
  | {
      readonly kind: "set_voice_muted";
      readonly voiceId: VoiceId;
      readonly muted: boolean;
    }
  | {
      readonly kind: "restore_original";
    };

export type ApplyScoreOperationResult =
  | {
      readonly status: "success";
      readonly document: ScoreDocument;
      readonly playback: PlaybackProfile;
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly status: "invalid" | "unsupported" | "failure";
      readonly diagnostics: readonly Diagnostic[];
    };

export type DecodeScoreResult =
  | {
      readonly ok: true;
      readonly document: ScoreDocument;
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly Diagnostic[];
    };

export function asTuneId(value: string): TuneId {
  return value as TuneId;
}

export function asVoiceId(value: string): VoiceId {
  return value as VoiceId;
}

export function asMeasureId(value: string): MeasureId {
  return value as MeasureId;
}

export function asEventId(value: string): EventId {
  return value as EventId;
}

export function asQuarterNoteBpm(value: number): QuarterNoteBpm {
  if (!Number.isInteger(value) || value < 20 || value > 300) {
    throw new Error("Quarter-note tempo must be an integer from 20 to 300 BPM.");
  }
  return value as QuarterNoteBpm;
}

export function asRevisionId(value: number): RevisionId {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Revision must be a non-negative integer.");
  }
  return value as RevisionId;
}
