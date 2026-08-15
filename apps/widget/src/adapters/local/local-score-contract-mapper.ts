import type { EvaluateScoreResult } from "@abcoda/application";
import type { EvaluateScoreResultDto, ScoreSnapshotDto } from "@abcoda/contracts";
import type { Diagnostic, RevisionedScore } from "@abcoda/domain";

function diagnosticDto(
  diagnostic: Diagnostic,
): NonNullable<EvaluateScoreResultDto["diagnostics"]>[number] {
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

function scoreSnapshotDto(score: RevisionedScore): ScoreSnapshotDto {
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
    diagnostics: score.diagnostics.map(diagnosticDto),
  };
}

export function localEvaluateResultDto(
  result: EvaluateScoreResult,
): EvaluateScoreResultDto {
  return result.status === "success"
    ? { status: "success", snapshot: scoreSnapshotDto(result.score) }
    : { status: "invalid", diagnostics: result.diagnostics.map(diagnosticDto) };
}
