import ABCJS from "abcjs";

export type VoiceKind = "pitched" | "unpitched_percussion";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function abcGlobalKey(abc: string): string {
  const value = abc.match(/^\s*K:\s*([^\n%]+)/m)?.[1]?.trim();
  return value && !/^none\b/i.test(value) ? value : "C";
}

export function inferVoiceKind(abc: string, voiceId: string): VoiceKind {
  const id = escapeRegExp(voiceId);
  const declaration = abc.match(new RegExp(`^\\s*V:\\s*${id}(?=\\s|$)(.*)$`, "m"))?.[1] ?? "";
  const inline = new RegExp(`\\[V:\\s*${id}\\s*\\]\\s*\\[K:\\s*none(?:\\s+clef\\s*=\\s*perc)?\\s*\\]`, "i");
  const implicitDefault = voiceId === "default" && !/^\s*V:/m.test(abc)
    ? abc.match(/^\s*K:\s*(.*)$/m)?.[1] ?? ""
    : "";
  return /\bclef\s*=\s*perc\b/i.test(declaration) || inline.test(abc) || /\bclef\s*=\s*perc\b/i.test(implicitDefault)
    ? "unpitched_percussion"
    : "pitched";
}

function setDeclarationClef(abc: string, voiceId: string, clef: "perc" | "treble"): string {
  const id = escapeRegExp(voiceId);
  const voiceLine = new RegExp(`^(\\s*V:\\s*${id})(?=\\s|$)(.*)$`, "gm");
  return abc.replace(voiceLine, (_whole, prefix: string, suffix: string) => {
    const explicit = /\bclef\s*=\s*(?:treble|alto|tenor|bass|perc|none)(?:[1-5])?(?:[+-]8)?\b/i;
    const next = explicit.test(suffix) ? suffix.replace(explicit, `clef=${clef}`) : `${suffix} clef=${clef}`;
    return `${prefix}${next}`.trimEnd();
  });
}

export function setVoiceKind(abc: string, voiceId: string, kind: VoiceKind, pitchedKey?: string): string {
  const id = escapeRegExp(voiceId);
  const key = pitchedKey ?? abcGlobalKey(abc);
  if (voiceId === "default" && !/^\s*V:/m.test(abc) && !/\[V:/i.test(abc)) {
    const replacement = kind === "unpitched_percussion" ? "K:none clef=perc" : `K:${key} clef=treble`;
    return /^\s*K:/m.test(abc)
      ? abc.replace(/^\s*K:.*$/m, replacement)
      : `${abc.trimEnd()}\n${replacement}`;
  }
  let next = setDeclarationClef(abc, voiceId, kind === "unpitched_percussion" ? "perc" : "treble");
  const inlineVoice = new RegExp(`\\[V:\\s*${id}\\s*\\](?:\\s*\\[K:\\s*[^\\]]+\\])?`, "g");
  next = next.replace(inlineVoice, (marker) => {
    const voiceMarker = marker.match(/^\[V:[^\]]+\]/)?.[0] ?? marker;
    return kind === "unpitched_percussion"
      ? `${voiceMarker}[K:none clef=perc]`
      : `${voiceMarker}[K:${key} clef=treble]`;
  });

  const lines = next.split("\n");
  const firstKey = lines.findIndex((line) => /^\s*K:/.test(line));
  for (let index = Math.max(0, firstKey + 1); index < lines.length; index += 1) {
    if (!new RegExp(`^\\s*V:\\s*${id}(?=\\s|$)`).test(lines[index] ?? "")) continue;
    const localKey = /^\s*K:/.test(lines[index + 1] ?? "");
    const replacement = kind === "unpitched_percussion" ? "K:none clef=perc" : `K:${key} clef=treble`;
    if (localKey) lines[index + 1] = replacement;
    else lines.splice(index + 1, 0, replacement);
    index += 1;
  }
  return lines.join("\n");
}

export function transposeAbc(abc: string, semitones: number): string {
  if (semitones === 0) return abc;
  if (!Number.isInteger(semitones) || semitones < -24 || semitones > 24) {
    throw new Error("Transposition must be a whole number between -24 and 24 semitones.");
  }
  const tunes = ABCJS.parseOnly(abc);
  if (!(tunes[0] as ABCJS.TuneObject | undefined)) throw new Error("The ABC could not be parsed for transposition.");
  return ABCJS.strTranspose(abc, tunes, semitones);
}
