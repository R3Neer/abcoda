import type {
  Diagnostic,
  RationalDuration,
  ScoreDocument,
  SourcePosition,
  SourceRange,
} from "@abcoda/domain";
import { addDuration } from "./rational";

function equal(left: RationalDuration, right: RationalDuration): boolean {
  return left.numerator === right.numerator && left.denominator === right.denominator;
}

function positionAt(source: string, offset: number): SourcePosition {
  const before = source.slice(0, offset);
  const lines = before.split("\n");
  return { line: lines.length, column: lines.at(-1)!.length + 1, offset };
}

function rangeAt(source: string, offset: number, length: number): SourceRange {
  return { start: positionAt(source, offset), end: positionAt(source, offset + length) };
}

function meterDiagnostics(document: ScoreDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const voice of document.voices) {
    const measures = voice.measures;
    for (const [index, measure] of measures.entries()) {
      if (!measure.expectedDuration || !measure.actualDuration) continue;
      if (equal(measure.expectedDuration, measure.actualDuration)) continue;

      const isEdge = index === 0 || index === measures.length - 1;
      const opposite = index === 0 ? measures.at(-1) : measures[0];
      const complementaryEdges = isEdge
        && measures.length > 1
        && opposite?.actualDuration
        && equal(addDuration(measure.actualDuration, opposite.actualDuration), measure.expectedDuration);
      if (complementaryEdges) continue;

      diagnostics.push({
        code: "ABC_MEASURE_DURATION_MISMATCH",
        severity: isEdge ? "warning" : "error",
        message: `Voice ${voice.id}, measure ${measure.number} has duration ${measure.actualDuration.numerator}/${measure.actualDuration.denominator}; expected ${measure.expectedDuration.numerator}/${measure.expectedDuration.denominator}.`,
        range: measure.source,
        suggestedCorrection: "Adjust note/rest lengths or the meter so the measure duration is explicit.",
      });
    }
  }
  return diagnostics;
}

function referenceDiagnostics(document: ScoreDocument): Diagnostic[] {
  const source = document.source.text;
  const declared = new Set(
    [...source.matchAll(/^V:\s*([^\s%]+)/gm)].map((match) => match[1]!),
  );
  const diagnostics: Diagnostic[] = [];
  for (const match of source.matchAll(/\[V:\s*([^\]\s%]+)/g)) {
    const id = match[1];
    if (!id || declared.has(id)) continue;
    const absolute = match.index ?? 0;
    diagnostics.push({
      code: "ABC_VOICE_ID_INVALID",
      severity: "error",
      message: `Voice ${id} is referenced but not declared.`,
      range: rangeAt(source, absolute, match[0].length),
      suggestedCorrection: `Declare V:${id} in the header or correct the reference.`,
    });
  }
  for (const score of document.directives.filter((directive) => directive.name.toLowerCase() === "score")) {
    for (const id of score.value.match(/[A-Za-z0-9_.-]+/g) ?? []) {
      if (declared.has(id)) continue;
      diagnostics.push({
        code: "ABC_VOICE_ID_INVALID",
        severity: "error",
        message: `Voice ${id} is grouped by %%score but not declared.`,
        range: score.source,
        suggestedCorrection: `Declare V:${id} or remove it from %%score.`,
      });
    }
  }
  return diagnostics;
}

export function validateScore(document: ScoreDocument): readonly Diagnostic[] {
  const diagnostics = [...referenceDiagnostics(document), ...meterDiagnostics(document)];
  const measureCounts = new Set(document.voices.map((voice) => voice.measures.length));
  if (measureCounts.size > 1) {
    diagnostics.push({
      code: "ABC_VOICE_MEASURE_COUNT_MISMATCH",
      severity: "warning",
      message: `Voices do not contain the same number of measures (${[...measureCounts].join(", ")}).`,
      suggestedCorrection: "Align bar lines across voices or confirm that the polymeter is intentional.",
    });
  }
  if (/^Q:/m.test(document.source.text) && !document.header.tempo) {
    diagnostics.push({
      code: "ABC_TEMPO_INVALID",
      severity: "warning",
      message: "The Q: field is not a supported quarter-note tempo from 20 to 300 BPM.",
      suggestedCorrection: "Use Q:1/4=<BPM>, with an integer BPM from 20 to 300.",
    });
  }
  return diagnostics;
}
