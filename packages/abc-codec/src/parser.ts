import {
  asEventId,
  asMeasureId,
  asQuarterNoteBpm,
  asTuneId,
  asVoiceId,
  type DecodeScoreResult,
  type Measure,
  type MusicalEvent,
  type MusicalEventKind,
  type RationalDuration,
  type ScoreDirective,
  type ScoreDocument,
  type ScoreVoiceDocument,
  type SourcePosition,
  type SourceRange,
  type VoiceId,
} from "@abcoda/domain";
import { addDuration, durationFromSuffix, multiplyDuration, rational } from "./rational";
import { validateScore } from "./validation";

interface SourceLine {
  readonly text: string;
  readonly line: number;
  readonly offset: number;
}

interface HeaderMatch {
  readonly name: string;
  readonly value: string;
  readonly range: SourceRange;
  readonly line: number;
}

interface TupletState {
  remaining: number;
  readonly multiplier: RationalDuration;
}

interface MutableMeasure {
  readonly number: number;
  readonly events: MusicalEvent[];
  startOffset?: number;
  endOffset?: number;
  actualDuration: RationalDuration;
  durationKnown: boolean;
}

interface VoiceBuilder {
  readonly id: VoiceId;
  readonly kind: "pitched" | "unpitched_percussion";
  readonly clef?: string;
  readonly transpositionSemitones?: number;
  readonly measures: Measure[];
  current: MutableMeasure;
  eventNumber: number;
  tuplet: TupletState | undefined;
}

function sourceLines(source: string): SourceLine[] {
  const result: SourceLine[] = [];
  let offset = 0;
  source.split("\n").forEach((text, index) => {
    result.push({ text, line: index + 1, offset });
    offset += text.length + 1;
  });
  return result;
}

function positionAt(lines: readonly SourceLine[], offset: number): SourcePosition {
  let low = 0;
  let high = lines.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const line = lines[middle]!;
    const next = lines[middle + 1];
    if (offset < line.offset) high = middle - 1;
    else if (next && offset >= next.offset) low = middle + 1;
    else return { line: line.line, column: offset - line.offset + 1, offset };
  }
  const last = lines.at(-1) ?? { text: "", line: 1, offset: 0 };
  return { line: last.line, column: offset - last.offset + 1, offset };
}

function sourceRange(lines: readonly SourceLine[], startOffset: number, endOffset: number): SourceRange {
  return { start: positionAt(lines, startOffset), end: positionAt(lines, endOffset) };
}

function headerMatches(lines: readonly SourceLine[]): HeaderMatch[] {
  return lines.flatMap((line) => {
    const match = /^([A-Za-z]):\s*(.*?)\s*$/.exec(line.text);
    return match
      ? [{
          name: match[1]!.toUpperCase(),
          value: match[2] ?? "",
          range: sourceRange(lines, line.offset, line.offset + line.text.length),
          line: line.line,
        }]
      : [];
  });
}

function parseRatio(value: string | undefined): RationalDuration | undefined {
  if (!value) return undefined;
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(value.trim());
  if (!fraction || Number(fraction[2]) === 0) return undefined;
  return rational(Number(fraction[1]), Number(fraction[2]));
}

function expectedDuration(meter: string | undefined): RationalDuration | undefined {
  if (!meter) return undefined;
  if (["C", "C|"].includes(meter.trim())) return rational(1);
  return parseRatio(meter);
}

function quarterNoteTempo(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /(?:^|\s)1\s*\/\s*4\s*=\s*(\d+)\s*$/.exec(value)
    ?? /^(\d+)$/.exec(value.trim());
  if (!match) return undefined;
  const bpm = Number(match[1]);
  return Number.isInteger(bpm) && bpm >= 20 && bpm <= 300 ? bpm : undefined;
}

function scoreOrder(directives: readonly ScoreDirective[]): string[] {
  const score = directives.find((directive) => directive.name.toLowerCase() === "score");
  return score
    ? [...score.value.matchAll(/[A-Za-z0-9_.-]+/g)].map((match) => match[0])
    : [];
}

function declaredVoices(
  source: string,
  headerEndOffset: number,
): Array<{ id: string; suffix: string }> {
  const declarations = new Map<string, string>();
  for (const match of source.slice(0, headerEndOffset).matchAll(/^V:\s*([^\s%]+)(.*)$/gm)) {
    const id = match[1];
    if (id && !declarations.has(id)) declarations.set(id, match[2] ?? "");
  }
  for (const match of source.matchAll(/\[V:\s*([^\]\s]+)[^\]]*\]/g)) {
    const id = match[1];
    if (id && !declarations.has(id)) declarations.set(id, "");
  }
  return [...declarations].map(([id, suffix]) => ({ id, suffix }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function voiceDescriptors(
  source: string,
  headerEndOffset: number,
  directives: readonly ScoreDirective[],
): Array<{
  id: string;
  kind: "pitched" | "unpitched_percussion";
  clef?: string;
  transpositionSemitones?: number;
}> {
  const declarations = declaredVoices(source, headerEndOffset);
  if (declarations.length === 0) {
    const key = /^K:\s*(.*)$/m.exec(source)?.[1] ?? "";
    return [{
      id: "default",
      kind: /\bclef\s*=\s*perc\b/i.test(key) ? "unpitched_percussion" : "pitched",
    }];
  }
  const byId = new Map(declarations.map((voice) => [voice.id, voice]));
  const scored = scoreOrder(directives);
  const orderedIds = [
    ...scored.filter((id) => byId.has(id)),
    ...declarations.map((voice) => voice.id).filter((id) => !scored.includes(id)),
  ];
  return [...new Set(orderedIds)].map((id) => {
    const suffix = byId.get(id)?.suffix ?? "";
    const clef = /\bclef\s*=\s*([^\s%]+)/i.exec(suffix)?.[1];
    const transpose = /\b(?:transpose|t)\s*=\s*(-?\d+)/i.exec(suffix)?.[1];
    const inlinePercussion = new RegExp(
      `\\[V:\\s*${escapeRegExp(id)}\\s*\\]\\s*\\[K:\\s*none[^\\]]*clef\\s*=\\s*perc`,
      "i",
    ).test(source);
    return {
      id,
      kind: /^perc(?:ussion)?/i.test(clef ?? "") || inlinePercussion
        ? "unpitched_percussion"
        : "pitched",
      ...(clef ? { clef } : {}),
      ...(transpose === undefined ? {} : { transpositionSemitones: Number(transpose) }),
    };
  });
}

function newMeasure(number: number): MutableMeasure {
  return {
    number,
    events: [],
    actualDuration: rational(0),
    durationKnown: true,
  };
}

function eventDuration(
  builder: VoiceBuilder,
  defaultLength: RationalDuration,
  suffix: string | undefined,
): RationalDuration {
  let duration = durationFromSuffix(defaultLength, suffix);
  if (builder.tuplet && builder.tuplet.remaining > 0) {
    duration = multiplyDuration(duration, builder.tuplet.multiplier);
    builder.tuplet.remaining -= 1;
    if (builder.tuplet.remaining === 0) builder.tuplet = undefined;
  }
  return duration;
}

function appendEvent(
  builder: VoiceBuilder,
  lines: readonly SourceLine[],
  kind: MusicalEventKind,
  lexeme: string,
  startOffset: number,
  duration?: RationalDuration,
): void {
  builder.eventNumber += 1;
  builder.current.startOffset ??= startOffset;
  builder.current.endOffset = startOffset + lexeme.length;
  builder.current.events.push({
    id: asEventId(`${builder.id}:m${builder.current.number}:e${builder.eventNumber}`),
    kind,
    lexeme,
    source: sourceRange(lines, startOffset, startOffset + lexeme.length),
    ...(duration ? { duration } : {}),
  });
  if (duration) builder.current.actualDuration = addDuration(builder.current.actualDuration, duration);
}

function finishMeasure(
  builder: VoiceBuilder,
  lines: readonly SourceLine[],
  expected: RationalDuration | undefined,
  endOffset?: number,
): void {
  const current = builder.current;
  if (current.events.length === 0) return;
  const start = current.startOffset ?? endOffset ?? 0;
  const end = endOffset ?? current.endOffset ?? start;
  builder.measures.push({
    id: asMeasureId(`${builder.id}:m${current.number}`),
    number: current.number,
    events: current.events,
    source: sourceRange(lines, start, end),
    ...(expected ? { expectedDuration: expected } : {}),
    ...(current.durationKnown ? { actualDuration: current.actualDuration } : {}),
  });
  builder.current = newMeasure(current.number + 1);
  builder.eventNumber = 0;
  builder.tuplet = undefined;
}

function bodyVoices(
  lines: readonly SourceLine[],
  firstKey: HeaderMatch,
  descriptors: ReturnType<typeof voiceDescriptors>,
  defaultLength: RationalDuration,
  expected: RationalDuration | undefined,
): ScoreVoiceDocument[] {
  const builders = new Map<string, VoiceBuilder>();
  for (const voice of descriptors) {
    builders.set(voice.id, {
      id: asVoiceId(voice.id),
      kind: voice.kind,
      ...(voice.clef ? { clef: voice.clef } : {}),
      ...(voice.transpositionSemitones === undefined
        ? {}
        : { transpositionSemitones: voice.transpositionSemitones }),
      measures: [],
      current: newMeasure(1),
      eventNumber: 0,
      tuplet: undefined,
    });
  }

  let current = builders.get(descriptors[0]?.id ?? "default")!;
  const durationToken = "(\\d+\\/\\d+|\\d+\\/|\\/\\d+|\\d+|\\/+)?";
  const notePattern = new RegExp(`^(?:\\^\\^?|__?|=)?[A-Ga-g][,']*${durationToken}-?`);
  const restPattern = new RegExp(`^[zx]${durationToken}`);

  for (const line of lines.slice(firstKey.line)) {
    let cursor = 0;
    const bodyVoice = /^V:\s*([^\s%]+)\s*/.exec(line.text);
    if (bodyVoice) {
      current = builders.get(bodyVoice[1] ?? "") ?? current;
      cursor = bodyVoice[0].length;
    }

    while (cursor < line.text.length) {
      const tail = line.text.slice(cursor);
      const absolute = line.offset + cursor;
      if (/^\s/.test(tail)) {
        cursor += 1;
        continue;
      }
      if (tail.startsWith("%")) break;

      const inlineVoice = /^\[V:\s*([^\]\s]+)[^\]]*\]/.exec(tail);
      if (inlineVoice) {
        current = builders.get(inlineVoice[1] ?? "") ?? current;
        cursor += inlineVoice[0].length;
        continue;
      }
      const bar = /^(?::\|\]?|\|:|\|\]|\|\||\|)/.exec(tail);
      if (bar) {
        cursor += bar[0].length;
        finishMeasure(current, lines, expected, absolute + bar[0].length);
        continue;
      }
      const inlineField = /^\[[A-Za-z]:[^\]]*\]/.exec(tail);
      if (inlineField) {
        appendEvent(current, lines, "inline_field", inlineField[0], absolute);
        cursor += inlineField[0].length;
        continue;
      }
      const chord = new RegExp(`^\\[(?![A-Za-z]:)[^\\]]+\\]${durationToken}-?`).exec(tail);
      if (chord) {
        appendEvent(
          current,
          lines,
          "chord",
          chord[0],
          absolute,
          eventDuration(current, defaultLength, chord[1]),
        );
        cursor += chord[0].length;
        continue;
      }
      const rest = restPattern.exec(tail);
      if (rest) {
        appendEvent(
          current,
          lines,
          "rest",
          rest[0],
          absolute,
          eventDuration(current, defaultLength, rest[1]),
        );
        cursor += rest[0].length;
        continue;
      }
      const note = notePattern.exec(tail);
      if (note) {
        appendEvent(
          current,
          lines,
          "note",
          note[0],
          absolute,
          eventDuration(current, defaultLength, note[1]),
        );
        cursor += note[0].length;
        continue;
      }
      const tuplet = /^\((\d+)(?::(\d*))?(?::(\d+))?/.exec(tail);
      if (tuplet) {
        const count = Number(tuplet[1]);
        const normal = Number(tuplet[2] || ([2, 4, 8].includes(count) ? 3 : 2));
        const affected = Number(tuplet[3] || count);
        current.tuplet = { remaining: affected, multiplier: rational(normal, count) };
        appendEvent(current, lines, "tuplet", tuplet[0], absolute);
        cursor += tuplet[0].length;
        continue;
      }
      const quoted = /^"(?:[^"\\]|\\.)*"/.exec(tail);
      if (quoted) {
        appendEvent(current, lines, "annotation", quoted[0], absolute);
        cursor += quoted[0].length;
        continue;
      }
      const decoration = /^![^!]*!|^\+[^+]*\+|^\{[^}]*\}|^[().~]/.exec(tail);
      if (decoration) {
        appendEvent(current, lines, "decoration", decoration[0], absolute);
        cursor += decoration[0].length;
        continue;
      }
      const opaque = /^[<>]|^\[[0-9]+/.exec(tail) ?? /^[^\s]+/.exec(tail);
      const lexeme = opaque?.[0] ?? tail[0]!;
      appendEvent(current, lines, "opaque", lexeme, absolute);
      if (/[<>]/.test(lexeme)) current.current.durationKnown = false;
      cursor += lexeme.length;
    }
  }

  for (const builder of builders.values()) finishMeasure(builder, lines, expected);
  return descriptors.map((descriptor) => {
    const builder = builders.get(descriptor.id)!;
    return {
      id: builder.id,
      kind: builder.kind,
      ...(builder.clef ? { clef: builder.clef } : {}),
      ...(builder.transpositionSemitones === undefined
        ? {}
        : { transpositionSemitones: builder.transpositionSemitones }),
      measures: builder.measures,
    };
  });
}

export function parseAbc(sourceInput: string): DecodeScoreResult {
  const source = sourceInput.replace(/\r\n?/g, "\n");
  if (source.trim().length === 0) {
    return {
      ok: false,
      diagnostics: [{ code: "ABC_SOURCE_EMPTY", severity: "error", message: "ABC source is empty." }],
    };
  }
  const lines = sourceLines(source);
  const headers = headerMatches(lines);
  const references = headers.filter((header) => header.name === "X");
  if (references.length === 0) {
    return {
      ok: false,
      diagnostics: [{
        code: "ABC_TUNE_REFERENCE_MISSING",
        severity: "error",
        message: "A complete ABC score must declare exactly one X: tune reference.",
      }],
    };
  }
  if (references.length > 1) {
    return {
      ok: false,
      diagnostics: [{
        code: "ABC_MULTIPLE_TUNES_UNSUPPORTED",
        severity: "error",
        message: `ABCoda accepts one tune per score snapshot; received ${references.length}.`,
        range: references[1]!.range,
      }],
    };
  }
  const reference = references[0]!;
  if (!reference.value) {
    return {
      ok: false,
      diagnostics: [{
        code: "ABC_TUNE_REFERENCE_INVALID",
        severity: "error",
        message: "The X: tune reference cannot be empty.",
        range: reference.range,
      }],
    };
  }

  const firstKey = headers.find((header) => header.name === "K");
  const headerEndOffset = firstKey?.range.end.offset ?? source.length;
  const directives: ScoreDirective[] = lines.flatMap((line) => {
    const directive = /^%%([^\s]+)\s*(.*)$/.exec(line.text);
    return directive
      ? [{
          name: directive[1]!,
          value: directive[2] ?? "",
          source: sourceRange(lines, line.offset, line.offset + line.text.length),
        }]
      : [];
  });
  const descriptors = voiceDescriptors(source, headerEndOffset, directives);
  const meter = headers.find((header) => header.name === "M")?.value;
  const explicitLength = parseRatio(headers.find((header) => header.name === "L")?.value);
  const defaultLength = explicitLength ?? rational(1, 8);
  const tempoValue = quarterNoteTempo(headers.find((header) => header.name === "Q")?.value);
  const voices = firstKey
    ? bodyVoices(lines, firstKey, descriptors, defaultLength, expectedDuration(meter))
    : descriptors.map((voice) => ({
        id: asVoiceId(voice.id),
        kind: voice.kind,
        ...(voice.clef ? { clef: voice.clef } : {}),
        ...(voice.transpositionSemitones === undefined
          ? {}
          : { transpositionSemitones: voice.transpositionSemitones }),
        measures: [],
      }));
  const title = headers.find((header) => header.name === "T")?.value;
  const key = firstKey?.value;

  const document: ScoreDocument = {
    tuneId: asTuneId(reference.value),
    header: {
      ...(title ? { title } : {}),
      ...(meter ? { meter } : {}),
      ...(explicitLength ? { defaultNoteLength: explicitLength } : {}),
      ...(key ? { key } : {}),
      ...(tempoValue === undefined
        ? {}
        : { tempo: { beatUnit: "quarter", bpm: asQuarterNoteBpm(tempoValue) } }),
    },
    voices,
    directives,
    source: { format: "abc", text: source },
  };
  return { ok: true, diagnostics: validateScore(document), document };
}
