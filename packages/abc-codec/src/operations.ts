import type {
  ApplyScoreOperationResult,
  PlaybackProfile,
  ScoreDocument,
  VoiceId,
} from "../../domain/src/index";
import type {
  ApplyScoreOperationCommand,
  ScoreOperationExecutor,
} from "../../application/src/index";
import {
  asVoiceId,
  instrumentDefinition,
  isInstrumentCompatible,
  type InstrumentId,
} from "../../domain/src/index";
import { parseAbc } from "./parser";
import { validateScore } from "./validation";

export interface NormalizationChange {
  readonly code: "NORMALIZE_NEWLINES" | "ADD_FINAL_NEWLINE";
  readonly message: string;
}

export interface NormalizationResult {
  readonly source: string;
  readonly changes: readonly NormalizationChange[];
}

export function normalizeAbc(source: string): NormalizationResult {
  const changes: NormalizationChange[] = [];
  let normalized = source;
  if (/\r/.test(normalized)) {
    normalized = normalized.replace(/\r\n?/g, "\n");
    changes.push({ code: "NORMALIZE_NEWLINES", message: "Normalized line endings to LF." });
  }
  if (normalized.length > 0 && !normalized.endsWith("\n")) {
    normalized += "\n";
    changes.push({ code: "ADD_FINAL_NEWLINE", message: "Added the final newline." });
  }
  return { source: normalized, changes };
}

const pitchClasses: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const sharpSpellings = ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"];

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function noteToMidi(note: string): number | undefined {
  const match = /^(\^\^?|__?|=)?([A-Ga-g])([,']*)/.exec(note);
  if (!match) return undefined;
  const letter = match[2]!;
  const upper = letter.toUpperCase();
  const accidental = match[1] ?? "";
  const accidentalOffset = accidental.startsWith("^")
    ? accidental.length
    : accidental.startsWith("_")
      ? -accidental.length
      : 0;
  let octave = letter === upper ? 4 : 5;
  for (const marker of match[3] ?? "") octave += marker === "'" ? 1 : -1;
  return 12 * (octave + 1) + pitchClasses[upper]! + accidentalOffset;
}

function midiToNote(midi: number): string {
  const pitchClass = modulo(midi, 12);
  const octave = Math.floor(midi / 12) - 1;
  const spelling = sharpSpellings[pitchClass]!;
  const accidental = spelling.startsWith("^") ? "^" : "";
  const letter = spelling.at(-1)!;
  if (octave >= 5) return `${accidental}${letter.toLowerCase()}${"'".repeat(octave - 5)}`;
  return `${accidental}${letter}${",".repeat(4 - octave)}`;
}

function transposeNoteLexeme(lexeme: string, semitones: number): string {
  const match = /^(\^\^?|__?|=)?[A-Ga-g][,']*/.exec(lexeme);
  if (!match) return lexeme;
  const midi = noteToMidi(match[0]);
  return midi === undefined ? lexeme : midiToNote(midi + semitones) + lexeme.slice(match[0].length);
}

function transposeChordLexeme(lexeme: string, semitones: number): string {
  const close = lexeme.indexOf("]");
  if (close < 0) return lexeme;
  const notes = lexeme.slice(1, close).replace(
    /(\^\^?|__?|=)?[A-Ga-g][,']*/g,
    (note) => transposeNoteLexeme(note, semitones),
  );
  return `[${notes}]${lexeme.slice(close + 1)}`;
}

function transposeKeyValue(value: string, semitones: number): string {
  if (/^(?:none|perc)/i.test(value.trim())) return value;
  const match = /^(\s*)([A-Ga-g])([#b]?)(.*)$/.exec(value);
  if (!match) return value;
  const accidental = match[3] === "#" ? 1 : match[3] === "b" ? -1 : 0;
  const pitch = pitchClasses[match[2]!.toUpperCase()]! + accidental + semitones;
  const abcSpelling = sharpSpellings[modulo(pitch, 12)]!;
  const spelling = abcSpelling.startsWith("^") ? `${abcSpelling.slice(1)}#` : abcSpelling;
  return `${match[1]}${spelling}${match[4]}`;
}

function transposeChordSymbol(lexeme: string, semitones: number): string {
  const match = /^"([A-Ga-g])([#b]?)([^"/]*)((?:\/)([A-Ga-g])([#b]?))?(.*)"$/.exec(lexeme);
  if (!match) return lexeme;
  const root = transposeKeyValue(`${match[1]}${match[2]}`, semitones).trim();
  const bass = match[5]
    ? `/${transposeKeyValue(`${match[5]}${match[6] ?? ""}`, semitones).trim()}`
    : "";
  return `"${root}${match[3]}${bass}${match[7]}"`;
}

function transposeKeys(source: string, semitones: number): string {
  return source
    .replace(/^K:([^\n]*)$/gm, (_, value: string) => `K:${transposeKeyValue(value, semitones)}`)
    .replace(/\[K:([^\]]*)\]/g, (_, value: string) => `[K:${transposeKeyValue(value, semitones)}]`);
}

interface Replacement {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function assertTransposition(semitones: number): void {
  if (!Number.isInteger(semitones) || semitones < -24 || semitones > 24) {
    throw new Error("Transposition must be a whole number between -24 and 24 semitones.");
  }
}

export function transposeDocument(document: ScoreDocument, semitones: number): ScoreDocument {
  if (semitones === 0) return document;
  assertTransposition(semitones);
  const replacements: Replacement[] = [];
  for (const voice of document.voices) {
    if (voice.kind === "unpitched_percussion") continue;
    for (const measure of voice.measures) {
      for (const event of measure.events) {
        const text = event.kind === "note"
          ? transposeNoteLexeme(event.lexeme, semitones)
          : event.kind === "chord"
            ? transposeChordLexeme(event.lexeme, semitones)
            : event.kind === "annotation"
              ? transposeChordSymbol(event.lexeme, semitones)
            : event.lexeme;
        if (text !== event.lexeme) {
          replacements.push({
            start: event.source.start.offset,
            end: event.source.end.offset,
            text,
          });
        }
      }
    }
  }
  let source = document.source.text;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    source = source.slice(0, replacement.start) + replacement.text + source.slice(replacement.end);
  }
  source = transposeKeys(source, semitones);
  const decoded = parseAbc(source);
  if (!decoded.ok) throw new Error(decoded.diagnostics[0]?.message ?? "Transposition failed.");
  return decoded.document;
}

export function transposeAbc(source: string, semitones: number): string {
  if (semitones === 0) return source;
  const decoded = parseAbc(source);
  if (!decoded.ok) throw new Error(decoded.diagnostics[0]?.message ?? "The ABC could not be parsed.");
  return transposeDocument(decoded.document, semitones).source.text;
}

export function transposeVoiceDocument(
  document: ScoreDocument,
  voiceIdInput: string,
  semitones: number,
): ScoreDocument {
  const voiceId = asVoiceId(voiceIdInput);
  const voice = document.voices.find(
    (candidate) => candidate.id === voiceId,
  );

  if (!voice) {
    throw new Error(`Unknown voice ${voiceIdInput}.`);
  }

  if (voice.kind === "unpitched_percussion") {
    throw new Error(
      `Percussion voice ${voiceIdInput} cannot be transposed tonally.`,
    );
  }

  if (semitones === 0) return document;
  assertTransposition(semitones);

  const replacements: Replacement[] = [];

  for (const measure of voice.measures) {
    for (const event of measure.events) {
      // Per-voice transposition changes the musical material of this
      // voice only. Global key signatures and harmony annotations
      // continue to describe the complete score.
      const text = event.kind === "note"
        ? transposeNoteLexeme(event.lexeme, semitones)
        : event.kind === "chord"
          ? transposeChordLexeme(event.lexeme, semitones)
          : event.lexeme;

      if (text !== event.lexeme) {
        replacements.push({
          start: event.source.start.offset,
          end: event.source.end.offset,
          text,
        });
      }
    }
  }

  let source = document.source.text;

  for (
    const replacement of replacements.sort(
      (left, right) => right.start - left.start,
    )
  ) {
    source =
      source.slice(0, replacement.start) +
      replacement.text +
      source.slice(replacement.end);
  }

  const decoded = parseAbc(source);

  if (!decoded.ok) {
    throw new Error(
      decoded.diagnostics[0]?.message
        ?? `Voice ${voiceIdInput} transposition failed.`,
    );
  }

  return decoded.document;
}

export function transposeVoiceAbc(
  source: string,
  voiceId: string,
  semitones: number,
): string {
  const decoded = parseAbc(source);

  if (!decoded.ok) {
    throw new Error(
      decoded.diagnostics[0]?.message
        ?? "The ABC could not be parsed.",
    );
  }

  return transposeVoiceDocument(
    decoded.document,
    voiceId,
    semitones,
  ).source.text;
}

export function assignInstrument(
  playback: PlaybackProfile,
  document: ScoreDocument,
  voiceId: VoiceId,
  instrumentId: InstrumentId,
): PlaybackProfile {
  const voice = document.voices.find((candidate) => candidate.id === voiceId);
  if (!voice) throw new Error(`Unknown voice ${voiceId}.`);
  if (!isInstrumentCompatible(voice.kind, instrumentId)) {
    throw new Error(`${instrumentDefinition(instrumentId).label} is incompatible with voice ${voiceId}.`);
  }
  return {
    ...playback,
    instruments: { ...playback.instruments, [voiceId]: instrumentId },
  };
}

export function setVoiceMuted(
  playback: PlaybackProfile,
  voiceIdInput: string,
  muted: boolean,
): PlaybackProfile {
  const voiceId = asVoiceId(voiceIdInput);
  const mutedVoices = new Set(playback.mutedVoices);
  if (muted) mutedVoices.add(voiceId);
  else mutedVoices.delete(voiceId);
  return { ...playback, mutedVoices: [...mutedVoices] };
}

export class CanonicalScoreOperations implements ScoreOperationExecutor {
  apply(command: ApplyScoreOperationCommand): ApplyScoreOperationResult {
    try {
      switch (command.operation.kind) {
        case "transpose": {
          const document = transposeDocument(command.document, command.operation.semitones);
          return {
            status: "success",
            document,
            playback: command.playback,
            diagnostics: validateScore(document),
          };
        }
        case "transpose_voice": {
          const document = transposeVoiceDocument(
            command.document,
            command.operation.voiceId,
            command.operation.semitones,
          );
          return {
            status: "success",
            document,
            playback: command.playback,
            diagnostics: validateScore(document),
          };
        }
        case "assign_instrument":
          return {
            status: "success",
            document: command.document,
            playback: assignInstrument(
              command.playback,
              command.document,
              command.operation.voiceId,
              command.operation.instrumentId,
            ),
            diagnostics: [],
          };
        case "set_voice_muted": {
          const operation = command.operation;
          if (!command.document.voices.some((voice) => voice.id === operation.voiceId)) {
            throw new Error(`Unknown voice ${operation.voiceId}.`);
          }
          return {
            status: "success",
            document: command.document,
            playback: setVoiceMuted(
              command.playback,
              operation.voiceId,
              operation.muted,
            ),
            diagnostics: [],
          };
        }
        case "restore_original":
          return {
            status: "success",
            document: command.original,
            playback: command.playback,
            diagnostics: [],
          };
      }
    } catch (cause) {
      return {
        status: "failure",
        diagnostics: [{
          code:
            command.operation.kind === "transpose"
            || command.operation.kind === "transpose_voice"
              ? "ABC_TRANSPOSITION_FAILED"
              : "ABC_OPERATION_FAILED",
          severity: "error",
          message: cause instanceof Error ? cause.message : "The score operation failed.",
        }],
      };
    }
  }
}
