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
  const voiceLine = new RegExp(`^(\\s*V:\\s*${id})(?=\\s|$)(.*)$`);
  const lines = abc.split("\n");
  const firstKey = lines.findIndex((line) => /^\s*K:/.test(line));
  const headerEnd = firstKey >= 0 ? firstKey : lines.length;
  return lines.map((line, index) => {
    if (index >= headerEnd) return line;
    const match = line.match(voiceLine);
    if (!match) return line;
    const prefix = match[1] ?? "";
    const suffix = match[2] ?? "";
    const explicit = /\bclef\s*=\s*(?:treble|alto|tenor|bass|perc|none)(?:[1-5])?(?:[+-]8)?\b/i;
    const next = explicit.test(suffix) ? suffix.replace(explicit, `clef=${clef}`) : `${suffix} clef=${clef}`;
    return `${prefix}${next}`.trimEnd();
  }).join("\n");
}

function setBodyVoiceKey(abc: string, voiceId: string, keyAndClef: string): string {
  const id = escapeRegExp(voiceId);
  const inlineVoice = new RegExp(`\\[V:\\s*${id}\\s*\\](?:\\s*\\[K:\\s*[^\\]]+\\])?`, "g");
  const bodyVoice = new RegExp(`^\\s*V:\\s*${id}(?=\\s|$)`);
  const lines = abc.split("\n");
  const firstKey = lines.findIndex((line) => /^\s*K:/.test(line));
  let pendingKey = false;

  for (let index = Math.max(0, firstKey + 1); index < lines.length; index += 1) {
    let line = lines[index] ?? "";

    if (pendingKey && /^\s*K:/.test(line)) {
      lines.splice(index, 1);
      index -= 1;
      continue;
    }

    if (pendingKey && /^\s*\[K:[^\]]+\]/.test(line)) {
      line = line.replace(/^\s*\[K:[^\]]+\]\s*/, "");
      lines[index] = line;
      if (!line.trim()) continue;
    }

    inlineVoice.lastIndex = 0;
    const match = inlineVoice.exec(line);
    if (match) {
      const before = line.slice(0, match.index);
      const voiceMarker = match[0].match(/^\[V:[^\]]+\]/)?.[0] ?? match[0];
      const tail = line.slice(match.index + match[0].length);
      if (tail.trim() === "" || /^\s*%/.test(tail)) {
        line = `${before}${voiceMarker}${tail}`;
        pendingKey = true;
      } else {
        line = `${before}${voiceMarker}[${keyAndClef}]${tail.trimStart()}`;
        pendingKey = false;
      }
      lines[index] = line;
      continue;
    }

    if (bodyVoice.test(line)) {
      lines[index] = line;
      pendingKey = true;
      continue;
    }

    if (!pendingKey) continue;
    if (!line.trim() || /^\s*%/.test(line) || /^\s*[A-Za-z]:/.test(line) || /^\s*\[V:/.test(line)) continue;
    lines[index] = line.replace(/^\s*/, `[${keyAndClef}]`);
    pendingKey = false;
  }

  return lines.join("\n");
}

export function setVoiceKind(abc: string, voiceId: string, kind: VoiceKind, pitchedKey?: string): string {
  const key = pitchedKey ?? abcGlobalKey(abc);
  if (voiceId === "default" && !/^\s*V:/m.test(abc) && !/\[V:/i.test(abc)) {
    const replacement = kind === "unpitched_percussion" ? "K:none clef=perc" : `K:${key} clef=treble`;
    return /^\s*K:/m.test(abc)
      ? abc.replace(/^\s*K:.*$/m, replacement)
      : `${abc.trimEnd()}\n${replacement}`;
  }
  const next = setDeclarationClef(abc, voiceId, kind === "unpitched_percussion" ? "perc" : "treble");
  const replacement = kind === "unpitched_percussion" ? "K:none clef=perc" : `K:${key} clef=treble`;
  return setBodyVoiceKey(next, voiceId, replacement);
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
