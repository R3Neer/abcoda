import {
  instrumentNotation,
  type InstrumentId,
  type RationalDuration,
  type ScoreVoiceDocument,
} from "@abcoda/domain";
import { parseAbc } from "./parser";

export type InstrumentAssignments = Readonly<Record<string, InstrumentId>>;

const metadataInstrument = /^%\s*abcoda:instrument\s+(\S+)\s+(\S+)\s*$/i;
const metadataBrace = /^%\s*abcoda:brace-group\s+(.+?)\s*$/i;
const scoreDirective = /^(\s*%%(?:score|staves)\s+)(.*)$/i;
const voiceDeclaration = /^(\s*V:\s*)([^\s%]+)(.*)$/i;
const labelProperty = /\s+(?:name|nm|subname|snm)\s*=\s*(?:"(?:[^"\\]|\\.)*"|'[^']*'|[^\s%]+)/gi;

interface SynthesizedStaff {
  readonly existingId: string;
  readonly companionId: string;
  readonly existingIndex: 0 | 1;
  readonly declaration: string;
  readonly body: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unquote(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function readVoiceProperty(suffix: string, names: readonly string[]): string | undefined {
  const alternatives = names.map(escapeRegExp).join("|");
  const match = new RegExp(
    `(?:^|\\s)(?:${alternatives})\\s*=\\s*("(?:[^"\\\\]|\\\\.)*"|'[^']*'|[^\\s%]+)`,
    "i",
  ).exec(suffix);
  return unquote(match?.[1]);
}

function quoteVoiceLabel(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function stripLabelProperties(suffix: string): string {
  return suffix.replace(labelProperty, "").replace(/\s+/g, " ").trim();
}

function splitComment(suffix: string): { core: string; comment: string } {
  const index = suffix.indexOf("%");
  if (index < 0) return { core: suffix, comment: "" };
  return { core: suffix.slice(0, index), comment: suffix.slice(index) };
}

function simpleBraceGroups(scoreBody: string): string[][] {
  return [...scoreBody.matchAll(/\{([^{}()[\]]+)\}/g)].flatMap((match) => {
    const ids = [...(match[1] ?? "").matchAll(/[A-Za-z0-9_.-]+/g)].map((item) => item[0]);
    return ids.length > 1 ? [ids] : [];
  });
}

function sameGroup(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function uniqueGroups(groups: readonly (readonly string[])[]): string[][] {
  const result: string[][] = [];
  for (const group of groups) {
    if (!result.some((candidate) => sameGroup(candidate, group))) result.push([...group]);
  }
  return result;
}

function sequencePattern(ids: readonly string[]): string {
  return ids.map(escapeRegExp).join("\\s*(?:\\|\\s*)?");
}

function setBraceState(scoreBody: string, ids: readonly string[], braced: boolean): string {
  if (ids.length < 2) return scoreBody;
  const sequence = sequencePattern(ids);
  const bracedPattern = new RegExp(`\\{\\s*(${sequence})\\s*\\}`);
  let next = scoreBody.replace(bracedPattern, "$1");
  if (!braced) return next;

  const barePattern = new RegExp(`(?<![A-Za-z0-9_.-])(${sequence})(?![A-Za-z0-9_.-])`);
  next = next.replace(barePattern, "{ $1 }");
  return next;
}

function insertCompanion(
  scoreBody: string,
  synthesized: SynthesizedStaff,
): string {
  const token = new RegExp(
    `(?<![A-Za-z0-9_.-])${escapeRegExp(synthesized.existingId)}(?![A-Za-z0-9_.-])`,
  );
  const sequence = synthesized.existingIndex === 0
    ? `${synthesized.existingId} | ${synthesized.companionId}`
    : `${synthesized.companionId} | ${synthesized.existingId}`;
  return scoreBody.replace(token, sequence);
}

function groupInstrument(
  group: readonly string[],
  instruments: InstrumentAssignments,
): InstrumentId | undefined {
  const assigned = group.map((id) => instruments[id]);
  if (assigned.some((instrument) => instrument === undefined)) return undefined;
  const first = assigned[0];
  return first && assigned.every((instrument) => instrument === first) ? first : undefined;
}

function isBraceTemplate(instrument: InstrumentId | undefined, count?: number): boolean {
  if (!instrument) return false;
  const staves = instrumentNotation(instrument).staves;
  return staves.kind === "fixed"
    && staves.connection === "brace"
    && staves.count > 1
    && (count === undefined || staves.count === count);
}

function groupMatchesNotation(
  group: readonly string[],
  instruments: InstrumentAssignments,
): boolean {
  return isBraceTemplate(groupInstrument(group, instruments), group.length);
}

function stripBodyVoiceLabels(line: string): string {
  let next = line;
  const declaration = voiceDeclaration.exec(next);
  if (declaration) {
    const { core, comment } = splitComment(declaration[3] ?? "");
    const cleaned = stripLabelProperties(core);
    next = `${declaration[1]}${declaration[2]}${cleaned ? ` ${cleaned}` : ""}${comment ? ` ${comment.trimStart()}` : ""}`;
  }

  return next.replace(/\[V:\s*([^\]\s]+)([^\]]*)\]/gi, (_whole, id: string, suffix: string) => {
    const cleaned = stripLabelProperties(suffix);
    return `[V:${id}${cleaned ? ` ${cleaned}` : ""}]`;
  });
}

function clefIndex(voice: ScoreVoiceDocument | undefined): 0 | 1 {
  if (!voice) return 0;
  let upper = /treble/i.test(voice.clef ?? "") ? 1 : 0;
  let lower = /bass/i.test(voice.clef ?? "") ? 1 : 0;
  for (const measure of voice.measures) {
    for (const event of measure.events) {
      if (event.kind !== "inline_field") continue;
      if (/clef\s*=\s*treble/i.test(event.lexeme)) upper += 1;
      if (/clef\s*=\s*bass/i.test(event.lexeme)) lower += 1;
    }
  }
  return lower > upper ? 1 : 0;
}

function orderGrandStaff(
  ids: readonly [string, string],
  voices: ReadonlyMap<string, ScoreVoiceDocument>,
): [string, string] {
  const firstIndex = clefIndex(voices.get(ids[0]));
  const secondIndex = clefIndex(voices.get(ids[1]));
  if (firstIndex === 1 && secondIndex === 0) return [ids[1], ids[0]];
  return [ids[0], ids[1]];
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}

function durationSuffix(
  duration: RationalDuration,
  defaultLength: RationalDuration,
): string {
  let numerator = duration.numerator * defaultLength.denominator;
  let denominator = duration.denominator * defaultLength.numerator;
  const divisor = gcd(numerator, denominator);
  numerator /= divisor;
  denominator /= divisor;
  if (denominator === 1) return numerator === 1 ? "" : String(numerator);
  return numerator === 1 ? `/${denominator}` : `${numerator}/${denominator}`;
}

function positiveDuration(duration: RationalDuration | undefined): duration is RationalDuration {
  return duration !== undefined && duration.numerator > 0 && duration.denominator > 0;
}

function companionBody(
  source: string,
  voice: ScoreVoiceDocument,
  defaultLength: RationalDuration,
  companionId: string,
): string | undefined {
  if (voice.measures.length === 0) return undefined;
  const measures = voice.measures.map((measure, index) => {
    const duration = positiveDuration(measure.actualDuration)
      ? measure.actualDuration
      : measure.expectedDuration;
    if (!positiveDuration(duration)) return undefined;
    const original = source.slice(measure.source.start.offset, measure.source.end.offset);
    const barline = /(:\|\]?|\|:|\|\]|\|\||\|)\s*$/.exec(original)?.[1]
      ?? (index === voice.measures.length - 1 ? "|]" : "|");
    return `z${durationSuffix(duration, defaultLength)}${barline}`;
  });
  if (measures.some((measure) => measure === undefined)) return undefined;
  return `[V:${companionId}] ${measures.join(" ")}`;
}

function uniqueVoiceId(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}${suffix}`)) suffix += 1;
  return `${base}${suffix}`;
}

function compatiblePrintedLabel(previous: string | undefined, canonical: string): boolean {
  if (!previous) return false;
  return previous === canonical || previous.startsWith(`${canonical} `);
}

function roman(value: number): string {
  const table: readonly [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let remaining = value;
  let result = "";
  for (const [amount, token] of table) {
    while (remaining >= amount) {
      result += token;
      remaining -= amount;
    }
  }
  return result || String(value);
}

function unitsForOrder(
  voiceOrder: readonly string[],
  activeGroups: readonly (readonly string[])[],
): string[][] {
  const result: string[][] = [];
  const consumed = new Set<string>();
  for (const id of voiceOrder) {
    if (consumed.has(id)) continue;
    const group = activeGroups.find((candidate) => candidate.includes(id));
    if (group) {
      result.push([...group]);
      group.forEach((voiceId) => consumed.add(voiceId));
    } else {
      result.push([id]);
      consumed.add(id);
    }
  }
  return result;
}

function scoreExpression(
  voiceOrder: readonly string[],
  activeGroups: readonly (readonly string[])[],
): string {
  return unitsForOrder(voiceOrder, activeGroups)
    .map((unit) => unit.length > 1 ? `{ ${unit.join(" | ")} }` : unit[0])
    .filter((value): value is string => value !== undefined)
    .join(" ");
}

/**
 * Applies the score-engraving policy for known instruments to canonical ABC.
 * Instrument names, abbreviations and fixed grand-staff structure are data,
 * not LLM output. New incomplete grand-staff instruments are completed with a
 * silent staff, while remembered groups that a user deliberately splits are
 * left split until their voices share a compatible multistaff instrument again.
 */
export function synchronizeInstrumentationAbc(
  source: string,
  instruments: InstrumentAssignments,
): string {
  const hadFinalNewline = /\r?\n$/.test(source);
  const normalizedSource = source.replace(/\r\n?/g, "\n");
  const originalLines = normalizedSource.split("\n");
  const normalizedInstruments: Record<string, InstrumentId> = { ...instruments };

  const previousInstruments: Record<string, InstrumentId> = {};
  const persistedGroups: string[][] = [];
  for (const line of originalLines) {
    const instrumentMatch = metadataInstrument.exec(line);
    if (instrumentMatch?.[1] && instrumentMatch[2]) {
      previousInstruments[instrumentMatch[1]] = instrumentMatch[2] as InstrumentId;
    }
    const braceMatch = metadataBrace.exec(line);
    if (braceMatch?.[1]) {
      const ids = braceMatch[1].trim().split(/\s+/).filter(Boolean);
      if (ids.length > 1) persistedGroups.push(ids);
    }
  }

  const currentScore = originalLines.find((line) => scoreDirective.test(line));
  const currentScoreBody = currentScore ? scoreDirective.exec(currentScore)?.[2] ?? "" : "";
  const currentBraceGroups = simpleBraceGroups(currentScoreBody);

  const parsed = parseAbc(normalizedSource);
  const parsedVoices = new Map<string, ScoreVoiceDocument>();
  if (parsed.ok) {
    for (const voice of parsed.document.voices) parsedVoices.set(String(voice.id), voice);
  }

  const lines = originalLines.filter(
    (line) => !metadataInstrument.test(line) && !metadataBrace.test(line),
  );
  let keyIndex = lines.findIndex((line) => /^\s*K\s*:/i.test(line));
  if (keyIndex < 0) return source;

  const declaredVoiceIds = lines
    .slice(0, keyIndex)
    .flatMap((line) => {
      const match = voiceDeclaration.exec(line);
      return match?.[2] ? [match[2]] : [];
    });
  if (declaredVoiceIds.length === 0) return source;

  const voiceOrder = parsed.ok
    ? parsed.document.voices.map((voice) => String(voice.id))
    : [...declaredVoiceIds];
  const usedVoiceIds = new Set(declaredVoiceIds);
  const rememberedVoiceIds = new Set(persistedGroups.flat());
  const candidateGroups: string[][] = [];

  for (const group of currentBraceGroups) {
    if (!groupMatchesNotation(group, normalizedInstruments)) continue;
    const instrument = groupInstrument(group, normalizedInstruments);
    if (!instrument || !isBraceTemplate(instrument, group.length)) continue;
    const ordered = group.length === 2
      ? orderGrandStaff([group[0]!, group[1]!], parsedVoices)
      : [...group];
    candidateGroups.push([...ordered]);
    ordered.forEach((id) => rememberedVoiceIds.add(id));
  }

  const synthesized: SynthesizedStaff[] = [];
  const generatedVoiceIds = new Set<string>();
  const defaultLength = parsed.ok
    ? parsed.document.header.defaultNoteLength ?? { numerator: 1, denominator: 8 }
    : { numerator: 1, denominator: 8 };

  for (let index = 0; index < voiceOrder.length; index += 1) {
    const id = voiceOrder[index]!;
    if (rememberedVoiceIds.has(id) || generatedVoiceIds.has(id)) continue;
    const instrument = normalizedInstruments[id];
    if (!instrument || !isBraceTemplate(instrument, 2)) continue;

    const nextId = voiceOrder[index + 1];
    if (
      nextId
      && !rememberedVoiceIds.has(nextId)
      && normalizedInstruments[nextId] === instrument
    ) {
      const ordered = orderGrandStaff([id, nextId], parsedVoices);
      candidateGroups.push(ordered);
      generatedVoiceIds.add(id);
      generatedVoiceIds.add(nextId);
      index += 1;
      continue;
    }

    if (!parsed.ok) continue;
    const voice = parsedVoices.get(id);
    if (!voice) continue;
    const existingIndex = clefIndex(voice);
    const companionIndex: 0 | 1 = existingIndex === 0 ? 1 : 0;
    const baseId = `${id}_${companionIndex === 0 ? "upper" : "lower"}`;
    const companionId = uniqueVoiceId(baseId, usedVoiceIds);
    const template = instrumentNotation(instrument).staves;
    if (template.kind !== "fixed" || template.count !== 2) continue;
    const body = companionBody(normalizedSource, voice, defaultLength, companionId);
    if (!body) continue;

    usedVoiceIds.add(companionId);
    normalizedInstruments[companionId] = instrument;
    const synthesizedStaff: SynthesizedStaff = {
      existingId: id,
      companionId,
      existingIndex,
      declaration: `V:${companionId} clef=${template.clefs[companionIndex]}`,
      body,
    };
    synthesized.push(synthesizedStaff);
    const group: [string, string] = existingIndex === 0
      ? [id, companionId]
      : [companionId, id];
    candidateGroups.push(group);
    generatedVoiceIds.add(id);
    generatedVoiceIds.add(companionId);
  }

  for (const item of synthesized) {
    lines.splice(keyIndex, 0, item.declaration);
    keyIndex += 1;
    const existingPosition = voiceOrder.indexOf(item.existingId);
    const insertion = item.existingIndex === 0 ? existingPosition + 1 : existingPosition;
    voiceOrder.splice(Math.max(0, insertion), 0, item.companionId);
  }
  if (synthesized.length > 0) lines.push(...synthesized.map((item) => item.body));

  const rememberedGroups = uniqueGroups([
    ...persistedGroups,
    ...candidateGroups,
  ]);
  const activeGroups = rememberedGroups.filter((group) => groupMatchesNotation(group, normalizedInstruments));

  let scoreIndex = lines.slice(0, keyIndex).findIndex((line) => scoreDirective.test(line));
  if (scoreIndex >= 0) {
    const match = scoreDirective.exec(lines[scoreIndex]!);
    if (match) {
      let body = match[2] ?? "";
      for (const group of currentBraceGroups) body = setBraceState(body, group, false);
      for (const item of synthesized) body = insertCompanion(body, item);
      for (const group of activeGroups) body = setBraceState(body, group, true);
      lines[scoreIndex] = `${match[1]}${body}`;
    }
  } else {
    const insertion = lines.slice(0, keyIndex).findIndex((line) => voiceDeclaration.test(line));
    scoreIndex = insertion >= 0 ? insertion : keyIndex;
    lines.splice(scoreIndex, 0, `%%score ${scoreExpression(voiceOrder, activeGroups)}`);
    keyIndex += 1;
  }

  const leaderByVoice = new Map<string, string>();
  for (const group of activeGroups) {
    const leader = group[0];
    if (!leader) continue;
    for (const id of group) leaderByVoice.set(id, leader);
  }

  const units = unitsForOrder(voiceOrder, activeGroups);
  const useSubnames = units.length > 1;
  const labelTotals = new Map<string, number>();
  for (const unit of units) {
    const leader = unit[0];
    const instrument = leader ? normalizedInstruments[leader] : undefined;
    if (!instrument) continue;
    const name = instrumentNotation(instrument).name;
    labelTotals.set(name, (labelTotals.get(name) ?? 0) + 1);
  }
  const labelSeen = new Map<string, number>();
  const canonicalByLeader = new Map<string, { name: string; subname: string }>();
  for (const unit of units) {
    const leader = unit[0];
    const instrument = leader ? normalizedInstruments[leader] : undefined;
    if (!leader || !instrument) continue;
    const policy = instrumentNotation(instrument);
    const total = labelTotals.get(policy.name) ?? 1;
    const ordinal = (labelSeen.get(policy.name) ?? 0) + 1;
    labelSeen.set(policy.name, ordinal);
    const suffix = total > 1 ? ` ${roman(ordinal)}` : "";
    canonicalByLeader.set(leader, {
      name: `${policy.name}${suffix}`,
      subname: `${policy.subname}${suffix}`,
    });
  }

  for (let index = 0; index < keyIndex; index += 1) {
    const line = lines[index]!;
    const match = voiceDeclaration.exec(line);
    if (!match?.[2]) continue;
    const id = match[2];
    const instrument = normalizedInstruments[id];
    if (!instrument) continue;

    const { core, comment } = splitComment(match[3] ?? "");
    const previousName = readVoiceProperty(core, ["name", "nm"]);
    const previousSubname = readVoiceProperty(core, ["subname", "snm"]);
    const cleaned = stripLabelProperties(core);
    const groupLeader = leaderByVoice.get(id);
    const leader = groupLeader ?? id;
    const isFollower = groupLeader !== undefined && groupLeader !== id;
    const changed = previousInstruments[id] !== undefined && previousInstruments[id] !== instrument;
    const canonical = canonicalByLeader.get(leader) ?? {
      name: instrumentNotation(instrument).name,
      subname: instrumentNotation(instrument).subname,
    };

    const fullName = isFollower
      ? undefined
      : !changed && compatiblePrintedLabel(previousName, instrumentNotation(instrument).name)
        ? previousName
        : canonical.name;
    const shortName = isFollower || !useSubnames
      ? undefined
      : !changed && compatiblePrintedLabel(previousSubname, instrumentNotation(instrument).subname)
        ? previousSubname
        : canonical.subname;

    lines[index] = [
      `${match[1]}${id}`,
      cleaned,
      fullName ? `name=${quoteVoiceLabel(fullName)}` : "",
      shortName ? `subname=${quoteVoiceLabel(shortName)}` : "",
      comment,
    ].filter(Boolean).join(" ");
  }

  for (let index = keyIndex + 1; index < lines.length; index += 1) {
    lines[index] = stripBodyVoiceLabels(lines[index]!);
  }

  const metadata = [
    ...rememberedGroups.map((group) => `% abcoda:brace-group ${group.join(" ")}`),
    ...voiceOrder.flatMap((id) => normalizedInstruments[id]
      ? [`% abcoda:instrument ${id} ${normalizedInstruments[id]}`]
      : []),
  ];
  if (metadata.length > 0) lines.splice(keyIndex, 0, ...metadata);

  let result = lines.join("\n");
  if (hadFinalNewline && !result.endsWith("\n")) result += "\n";
  if (!hadFinalNewline) result = result.replace(/\n$/, "");
  return result;
}
