import ABCJS from "abcjs";
import type { RenderScoreInput } from "./score.js";
import { extractVoiceIds } from "./voices.js";

export interface NormalizedScore {
  score: RenderScoreInput;
  warnings: string[];
}

const requiredHeaders = ["X", "T", "M", "L", "Q", "K"] as const;
const explicitClef = /\bclef\s*=\s*(?:treble|alto|tenor|bass|perc|none)(?:[1-5])?(?:[+-]8)?\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasHeader(abc: string, field: string): boolean {
  return new RegExp(`^\\s*${field}:`, "m").test(abc);
}

function normalizeTempo(abc: string, tempo: number): string {
  const lines = abc.replace(/\r\n?/g, "\n").split("\n");
  const keyIndex = lines.findIndex((line) => /^\s*K:/.test(line));
  const headerEnd = keyIndex >= 0 ? keyIndex : lines.length;
  const qIndex = lines.findIndex((line, index) => index < headerEnd && /^\s*Q:/.test(line));

  if (qIndex >= 0) {
    const line = lines[qIndex] ?? "Q:";
    if (/\d+\s*\/\s*\d+\s*=\s*\d+/.test(line)) {
      lines[qIndex] = line.replace(/\d+\s*\/\s*\d+\s*=\s*\d+/, `1/4=${tempo}`);
    } else {
      const label = [...line.matchAll(/"[^"]*"/g)].map((match) => match[0]).join(" ");
      lines[qIndex] = `Q:${label ? `${label} ` : ""}1/4=${tempo}`;
    }
  } else {
    lines.splice(headerEnd, 0, `Q:1/4=${tempo}`);
  }

  return lines.join("\n").trimEnd();
}

function normalizePercussionVoice(abc: string, voiceId: string): string {
  const escapedId = escapeRegExp(voiceId);
  const voiceLine = new RegExp(`^(\\s*V:\\s*${escapedId})(?=\\s|$)(.*)$`, "gm");
  let normalized = abc.replace(voiceLine, (_whole, prefix: string, suffix: string) => {
    const next = explicitClef.test(suffix)
      ? suffix.replace(explicitClef, "clef=perc")
      : `${suffix} clef=perc`;
    return `${prefix}${next}`.trimEnd();
  });

  const inlineVoice = new RegExp(`\\[V:\\s*${escapedId}\\s*\\](?!\\s*\\[K:\\s*none(?:\\s+clef=perc)?\\s*\\])`, "g");
  normalized = normalized.replace(inlineVoice, (marker) => `${marker}[K:none clef=perc]`);

  const lines = normalized.split("\n");
  const firstKey = lines.findIndex((line) => /^\s*K:/.test(line));
  for (let index = Math.max(0, firstKey + 1); index < lines.length; index += 1) {
    if (!new RegExp(`^\\s*V:\\s*${escapedId}(?=\\s|$)`).test(lines[index] ?? "")) continue;
    if (/^\s*K:\s*none\b/i.test(lines[index + 1] ?? "")) continue;
    lines.splice(index + 1, 0, "K:none clef=perc");
    index += 1;
  }
  return lines.join("\n");
}

function normalizeVoiceTranspose(abc: string, voiceId: string, semitones: number): string {
  if (semitones === 0) return abc;
  const escapedId = escapeRegExp(voiceId);
  const voiceLine = new RegExp(`^(\\s*V:\\s*${escapedId})(?=\\s|$)(.*)$`, "gm");
  return abc.replace(voiceLine, (_whole, prefix: string, suffix: string) => {
    const transpose = /\b(?:transpose|t)\s*=\s*-?\d+\b/i;
    const next = transpose.test(suffix)
      ? suffix.replace(transpose, `transpose=${semitones}`)
      : `${suffix} transpose=${semitones}`;
    return `${prefix}${next}`.trimEnd();
  });
}

function declaredVoiceOccurrences(abc: string): string[] {
  const firstKey = abc.search(/^\s*K:/m);
  const header = firstKey >= 0 ? abc.slice(0, firstKey) : abc;
  return [...header.matchAll(/^\s*V:\s*([^\s%]+)/gm)].map((match) => match[1]).filter(Boolean) as string[];
}

function scoreDirectiveVoiceIds(abc: string): string[] {
  const directive = abc.match(/^\s*%%score\s+(.+)$/m)?.[1];
  if (!directive) return [];
  return [...directive.matchAll(/[A-Za-z0-9_.-]+/g)].map((match) => match[0]);
}

type ParsedBeamNote = ABCJS.VoiceItemNote & { startBeam?: true; endBeam?: true };

function hasSuspiciousUnbeamedRun(abc: string): boolean {
  const runIsSuspicious = (runLength: number, containsBeam: boolean) => runLength >= 4 && !containsBeam;

  for (const tune of ABCJS.parseOnly(abc)) {
    for (const line of tune.lines) {
      for (const staff of line.staff ?? []) {
        for (const voice of staff.voices ?? []) {
          let runLength = 0;
          let containsBeam = false;
          for (const item of voice) {
            if (item.el_type === "bar") {
              if (runIsSuspicious(runLength, containsBeam)) return true;
              runLength = 0;
              containsBeam = false;
              continue;
            }
            if (item.el_type !== "note") continue;
            const note = item as ParsedBeamNote;
            const beamablePitchedEvent = note.duration > 0 && note.duration <= 1 / 8 && (note.pitches?.length ?? 0) > 0;
            if (beamablePitchedEvent) {
              runLength += 1;
              containsBeam ||= note.startBeam === true || note.endBeam === true;
            } else {
              if (runIsSuspicious(runLength, containsBeam)) return true;
              runLength = 0;
              containsBeam = false;
            }
          }
          if (runIsSuspicious(runLength, containsBeam)) return true;
        }
      }
    }
  }
  return false;
}

function lintMetadata(score: RenderScoreInput): string[] {
  const warnings: string[] = [];
  const voiceIds = extractVoiceIds(score.abc);
  const voiceSet = new Set(voiceIds);

  for (const field of requiredHeaders) {
    if (!hasHeader(score.abc, field)) warnings.push(`ABC header ${field}: is missing.`);
  }

  const occurrences = declaredVoiceOccurrences(score.abc);
  for (const id of new Set(occurrences)) {
    if (occurrences.filter((candidate) => candidate === id).length > 1) {
      warnings.push(`Voice ${id} is declared more than once with V:.`);
    }
  }

  const referenced = new Set([
    ...Object.keys(score.playback.instruments),
    ...score.playback.mutedVoices,
    ...Object.keys(score.notation.voiceKinds),
  ]);
  for (const id of referenced) {
    if (!voiceSet.has(id)) warnings.push(`Configuration references unknown voice ${id}.`);
  }

  const scoreVoices = scoreDirectiveVoiceIds(score.abc);
  for (const id of scoreVoices) {
    if (!voiceSet.has(id)) warnings.push(`%%score references undeclared voice ${id}.`);
  }
  if (voiceIds.length > 1 && scoreVoices.length === 0) {
    warnings.push("Multiple voices are present without a %%score grouping; staff layout may be ambiguous.");
  }
  for (const id of voiceIds) {
    if (scoreVoices.length > 0 && !scoreVoices.includes(id)) {
      warnings.push(`Voice ${id} is omitted from %%score and may not be engraved.`);
    }
  }

  if (score.composition && hasSuspiciousUnbeamedRun(score.abc)) {
    warnings.push("ABC contains four or more consecutive eighth-or-shorter notes with no beam grouping. Whitespace breaks beams in ABC; review grouping against the meter. Separate flags can still be intentional for syllabic vocal, historical, phrasing, or other explicit notation reasons.");
  }

  return warnings;
}

function normalizedField(value: string): string {
  return value.replace(/^\s*[A-Za-z]:\s*/, "").replace(/\s+/g, "").toLowerCase();
}

function lintComposition(score: RenderScoreInput, originalKinds: Record<string, "pitched" | "unpitched_percussion">): string[] {
  const brief = score.composition;
  if (!brief) return [];
  const warnings: string[] = [];
  const voiceIds = new Set(extractVoiceIds(score.abc));
  const briefIds = new Set(brief.ensemble.map((voice) => voice.voiceId));

  if (brief.tempo !== score.playback.tempo) {
    warnings.push(`Composition tempo ${brief.tempo} differs from playback tempo ${score.playback.tempo}; playback tempo currently wins.`);
  }

  const abcMeter = score.abc.match(/^\s*M:\s*(.+)$/m)?.[1];
  if (abcMeter && normalizedField(abcMeter) !== normalizedField(brief.meter)) {
    warnings.push(`Composition meter ${brief.meter} differs from ABC M:${abcMeter.trim()}.`);
  }

  for (const id of briefIds) {
    if (!voiceIds.has(id)) warnings.push(`Composition brief voice ${id} is missing from the ABC.`);
  }
  for (const id of voiceIds) {
    if (!briefIds.has(id)) warnings.push(`ABC voice ${id} is not described by the composition brief.`);
  }

  for (const voice of brief.ensemble) {
    const explicit = originalKinds[voice.voiceId];
    if (explicit && explicit !== voice.kind) {
      warnings.push(`Voice ${voice.voiceId} has conflicting kinds: composition=${voice.kind}, notation=${explicit}; composition kind wins.`);
    }
  }
  return warnings;
}

export function normalizeAndLintScore(input: RenderScoreInput): NormalizedScore {
  const originalKinds = { ...input.notation.voiceKinds };
  const inferredKinds = Object.fromEntries(
    (input.composition?.ensemble ?? []).map((voice) => [voice.voiceId, voice.kind]),
  ) as Record<string, "pitched" | "unpitched_percussion">;
  const notation = { voiceKinds: { ...originalKinds, ...inferredKinds } };
  let abc = normalizeTempo(input.abc, input.playback.tempo);
  for (const voice of input.composition?.ensemble ?? []) {
    abc = normalizeVoiceTranspose(abc, voice.voiceId, voice.transpositionSemitones);
  }
  for (const [voiceId, kind] of Object.entries(notation.voiceKinds)) {
    if (kind === "unpitched_percussion") abc = normalizePercussionVoice(abc, voiceId);
  }

  const instruments = { ...input.playback.instruments };
  for (const [voiceId, kind] of Object.entries(notation.voiceKinds)) {
    if (kind === "unpitched_percussion") instruments[voiceId] = "percussion";
    else if (instruments[voiceId] === "percussion") instruments[voiceId] = "acoustic_grand_piano";
  }

  const score: RenderScoreInput = {
    ...input,
    abc,
    notation,
    playback: { ...input.playback, instruments },
  };
  return { score, warnings: [...lintMetadata(score), ...lintComposition(score, originalKinds)] };
}
