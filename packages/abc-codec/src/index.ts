import type { ScoreCodec } from "../../application/src/index";
import {
  asTuneId,
  asVoiceId,
  type DecodeScoreResult,
  type Diagnostic,
  type SourceRange,
} from "../../domain/src/index";

interface HeaderMatch {
  readonly value: string;
  readonly range: SourceRange;
}

function lineRange(line: string, lineIndex: number, offset: number): SourceRange {
  return {
    start: { line: lineIndex + 1, column: 1, offset },
    end: { line: lineIndex + 1, column: line.length + 1, offset: offset + line.length },
  };
}

function headers(source: string, name: string): HeaderMatch[] {
  const matches: HeaderMatch[] = [];
  const lines = source.split("\n");
  let offset = 0;

  for (const [lineIndex, line] of lines.entries()) {
    const match = new RegExp(`^${name}:\\s*(.*?)\\s*$`).exec(line);
    if (match) {
      matches.push({
        value: match[1] ?? "",
        range: lineRange(line, lineIndex, offset),
      });
    }
    offset += line.length + 1;
  }

  return matches;
}

function voiceIds(source: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const patterns = [/^V:\s*([^\s]+)/gm, /\[V:\s*([^\]\s]+)/g];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const id = match[1];
      if (id && !seen.has(id)) {
        ids.push(id);
        seen.add(id);
      }
    }
  }

  return ids.length > 0 ? ids : ["default"];
}

export class BaselineAbcCodec implements ScoreCodec {
  decode(input: string): DecodeScoreResult {
    const source = input.replace(/\r\n?/g, "\n");
    if (source.trim().length === 0) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "ABC_SOURCE_EMPTY",
            severity: "error",
            message: "ABC source is empty.",
          },
        ],
      };
    }

    const tuneReferences = headers(source, "X");
    if (tuneReferences.length === 0) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "ABC_TUNE_REFERENCE_MISSING",
            severity: "error",
            message: "A complete ABC score must declare exactly one X: tune reference.",
          },
        ],
      };
    }

    if (tuneReferences.length > 1) {
      const diagnostic: Diagnostic = {
        code: "ABC_MULTIPLE_TUNES_UNSUPPORTED",
        severity: "error",
        message: `ABCoda accepts one tune per score snapshot; received ${tuneReferences.length}.`,
        range: tuneReferences[1]!.range,
      };
      return { ok: false, diagnostics: [diagnostic] };
    }

    const reference = tuneReferences[0]!;
    if (reference.value.length === 0) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "ABC_TUNE_REFERENCE_INVALID",
            severity: "error",
            message: "The X: tune reference cannot be empty.",
            range: reference.range,
          },
        ],
      };
    }

    const title = headers(source, "T")[0]?.value;
    const voices = voiceIds(source).map(asVoiceId);

    return {
      ok: true,
      diagnostics: [],
      document: {
        tuneId: asTuneId(reference.value),
        ...(title ? { title } : {}),
        voiceIds: voices,
        source: { format: "abc", text: source },
      },
    };
  }
}
