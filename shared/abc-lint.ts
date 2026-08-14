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

  return warnings;
}

export function normalizeAndLintScore(input: RenderScoreInput): NormalizedScore {
  let abc = normalizeTempo(input.abc, input.playback.tempo);
  for (const [voiceId, kind] of Object.entries(input.notation.voiceKinds)) {
    if (kind === "unpitched_percussion") abc = normalizePercussionVoice(abc, voiceId);
  }

  const score: RenderScoreInput = { ...input, abc };
  return { score, warnings: lintMetadata(score) };
}
