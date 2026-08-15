import type { VoiceKind } from "./instruments";

export type Brand<Value, Name extends string> = Value & {
  readonly __brand: Name;
};

export type TuneId = Brand<string, "TuneId">;
export type VoiceId = Brand<string, "VoiceId">;
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

export type DiagnosticSeverity = "info" | "warning" | "error";

export type DiagnosticCode =
  | "ABC_TUNE_REFERENCE_MISSING"
  | "ABC_MULTIPLE_TUNES_UNSUPPORTED"
  | "ABC_TUNE_REFERENCE_INVALID"
  | "ABC_VOICE_ID_INVALID"
  | "ABC_SOURCE_EMPTY";

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly range?: SourceRange;
}

export interface AbcSource {
  readonly format: "abc";
  readonly text: string;
}

export interface ScoreDocument {
  readonly tuneId: TuneId;
  readonly title?: string;
  readonly meter?: string;
  readonly key?: string;
  readonly tempo?: {
    readonly beatUnit: "quarter";
    readonly bpm: QuarterNoteBpm;
  };
  readonly voices: readonly ScoreVoice[];
  readonly source: AbcSource;
}

export interface ScoreVoice {
  readonly id: VoiceId;
  readonly kind: VoiceKind;
}

export interface ScoreSnapshot {
  readonly schemaVersion: 2;
  readonly revision: number;
  readonly document: ScoreDocument;
  readonly diagnostics: readonly Diagnostic[];
}

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

export function asQuarterNoteBpm(value: number): QuarterNoteBpm {
  if (!Number.isInteger(value) || value < 20 || value > 300) {
    throw new Error("Quarter-note tempo must be an integer from 20 to 300 BPM.");
  }
  return value as QuarterNoteBpm;
}

export * from "./instruments";
