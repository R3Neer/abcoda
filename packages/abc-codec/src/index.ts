import type { ScoreCodec } from "../../application/src/index";
import {
  asTuneId,
  asVoiceId,
  asQuarterNoteBpm,
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

function voices(source: string): Array<{ id: string; kind: "pitched" | "unpitched_percussion" }> {
  const declarations = new Map<string, "pitched" | "unpitched_percussion">();
  for (const match of source.matchAll(/^V:\s*([^\s]+)(.*)$/gm)) {
    const id = match[1];
    if (id && !declarations.has(id)) {
      declarations.set(id, /(?:^|\s)clef\s*=\s*perc(?:ussion)?(?:\s|$)/i.test(match[2] ?? "")
        ? "unpitched_percussion"
        : "pitched");
    }
  }

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

  const ordered = ids.length > 0 ? ids : ["default"];
  return ordered.map((id) => ({ id, kind: declarations.get(id) ?? "pitched" }));
}

function quarterNoteTempo(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^(?:1\s*\/\s*4\s*=\s*)?(\d+)$/.exec(value);
  if (!match) return undefined;
  const bpm = Number(match[1]);
  return Number.isInteger(bpm) && bpm >= 20 && bpm <= 300 ? bpm : undefined;
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
    const meter = headers(source, "M")[0]?.value;
    const key = headers(source, "K")[0]?.value;
    const bpm = quarterNoteTempo(headers(source, "Q")[0]?.value);
    const scoreVoices = voices(source).map((voice) => ({
      id: asVoiceId(voice.id),
      kind: voice.kind,
    }));

    return {
      ok: true,
      diagnostics: [],
      document: {
        tuneId: asTuneId(reference.value),
        ...(title ? { title } : {}),
        ...(meter ? { meter } : {}),
        ...(key ? { key } : {}),
        ...(bpm === undefined
          ? {}
          : { tempo: { beatUnit: "quarter" as const, bpm: asQuarterNoteBpm(bpm) } }),
        voices: scoreVoices,
        source: { format: "abc", text: source },
      },
    };
  }
}
