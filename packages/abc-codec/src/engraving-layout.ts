const inlineClefAtLineEnd = /\[K:[^\]\r\n]*\bclef\s*=\s*[^\]\s]+[^\]\r\n]*\][ \t]*$/i;
const physicalLineBreak = /\r\n|\n|\r/g;

function isMusicContinuation(line: string): boolean {
  const trimmed = line.trimStart();
  if (!trimmed || trimmed.startsWith("%")) return false;
  return !/^[A-Za-z]\s*:/.test(trimmed);
}

/**
 * Prevents an inline clef/key change from becoming a symbol-only physical
 * music line. Replacing the line break with same-length spaces preserves all
 * source offsets used by abcjs selection, timing and cursor integration.
 *
 * This deliberately does not move header fields or arbitrary directives. It
 * only joins an inline K: field containing clef= when the following physical
 * line is music continuation rather than another file/header field.
 */
export function normalizeEngravingLayoutAbc(source: string): string {
  const breaks = [...source.matchAll(physicalLineBreak)];
  if (breaks.length === 0) return source;

  let output = "";
  let lineStart = 0;
  for (let index = 0; index < breaks.length; index += 1) {
    const match = breaks[index]!;
    const breakStart = match.index;
    const breakText = match[0];
    const nextBreakStart = breaks[index + 1]?.index ?? source.length;
    const line = source.slice(lineStart, breakStart);
    const nextLine = source.slice(breakStart + breakText.length, nextBreakStart);

    output += line;
    output += inlineClefAtLineEnd.test(line) && isMusicContinuation(nextLine)
      ? " ".repeat(breakText.length)
      : breakText;
    lineStart = breakStart + breakText.length;
  }

  output += source.slice(lineStart);
  return output;
}
