import type { EvaluateScoreResult } from "@abcoda/application";
import type {
  EvaluateScoreResultDto,
  ScoreSnapshotDto,
} from "@abcoda/contracts";
import {
  asQuarterNoteBpm,
  asRevisionId,
  asTuneId,
  asVoiceId,
  type Diagnostic,
  type RevisionedScore,
} from "@abcoda/domain";

function toDiagnosticDto(diagnostic: Diagnostic): NonNullable<EvaluateScoreResultDto["diagnostics"]>[number] {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    ...(diagnostic.range === undefined ? {} : { range: diagnostic.range }),
    ...(diagnostic.suggestedCorrection === undefined
      ? {}
      : { suggestedCorrection: diagnostic.suggestedCorrection }),
  };
}

function fromDiagnosticDto(
  diagnostic: ScoreSnapshotDto["diagnostics"][number],
): Diagnostic {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    ...(diagnostic.range === undefined ? {} : { range: diagnostic.range }),
    ...(diagnostic.suggestedCorrection === undefined
      ? {}
      : { suggestedCorrection: diagnostic.suggestedCorrection }),
  };
}

export function toScoreSnapshotDto(score: RevisionedScore): ScoreSnapshotDto {
  return {
    schemaVersion: 2,
    revision: score.revision,
    document: {
      tuneId: score.document.tuneId,
      ...(score.document.title === undefined ? {} : { title: score.document.title }),
      ...(score.document.meter === undefined ? {} : { meter: score.document.meter }),
      ...(score.document.key === undefined ? {} : { key: score.document.key }),
      ...(score.document.tempo === undefined
        ? {}
        : {
            tempo: {
              beatUnit: "quarter",
              bpm: score.document.tempo.bpm,
            },
          }),
      voices: score.document.voices.map((voice) => ({
        id: voice.id,
        kind: voice.kind,
      })),
      source: score.document.source,
    },
    diagnostics: score.diagnostics.map(toDiagnosticDto),
  };
}

export function fromScoreSnapshotDto(snapshot: ScoreSnapshotDto): RevisionedScore {
  return {
    revision: asRevisionId(snapshot.revision),
    document: {
      source: snapshot.document.source,
      tuneId: asTuneId(snapshot.document.tuneId),
      voices: snapshot.document.voices.map((voice) => ({
        id: asVoiceId(voice.id),
        kind: voice.kind,
      })),
      ...(snapshot.document.title === undefined
        ? {}
        : { title: snapshot.document.title }),
      ...(snapshot.document.meter === undefined
        ? {}
        : { meter: snapshot.document.meter }),
      ...(snapshot.document.key === undefined
        ? {}
        : { key: snapshot.document.key }),
      ...(snapshot.document.tempo === undefined
        ? {}
        : {
            tempo: {
              beatUnit: "quarter" as const,
              bpm: asQuarterNoteBpm(snapshot.document.tempo.bpm),
            },
          }),
    },
    diagnostics: snapshot.diagnostics.map(fromDiagnosticDto),
  };
}

export function toEvaluateScoreResultDto(
  result: EvaluateScoreResult,
): EvaluateScoreResultDto {
  return result.status === "success"
    ? {
        status: "success",
        snapshot: toScoreSnapshotDto(result.score),
      }
    : {
        status: "invalid",
        diagnostics: result.diagnostics.map(toDiagnosticDto),
      };
}
