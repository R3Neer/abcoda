import {
  instrumentDefinition,
  type InstrumentId,
} from "@abcoda/domain";

export type InstrumentAssignments = Readonly<Record<string, InstrumentId>>;

interface ScoreInstrumentLabel {
  readonly full: string;
  readonly short: string;
}

const scoreLabels: Partial<Record<InstrumentId, ScoreInstrumentLabel>> = {
  acoustic_grand_piano: { full: "Piano", short: "Pno." },
  bright_acoustic_piano: { full: "Piano", short: "Pno." },
  church_organ: { full: "Organ", short: "Org." },
  acoustic_guitar_nylon: { full: "Guitar", short: "Gtr." },
  acoustic_bass: { full: "Bass", short: "Bass" },
  violin: { full: "Violin", short: "Vln." },
  viola: { full: "Viola", short: "Vla." },
  cello: { full: "Cello", short: "Vc." },
  contrabass: { full: "Double bass", short: "Db." },
  string_ensemble_1: { full: "Strings", short: "Str." },
  choir_aahs: { full: "Choir", short: "Ch." },
  trumpet: { full: "Trumpet", short: "Tpt." },
  trombone: { full: "Trombone", short: "Tbn." },
  french_horn: { full: "Horn", short: "Hn." },
  soprano_sax: { full: "Soprano saxophone", short: "S. sax." },
  alto_sax: { full: "Alto saxophone", short: "A. sax." },
  tenor_sax: { full: "Tenor saxophone", short: "T. sax." },
  oboe: { full: "Oboe", short: "Ob." },
  english_horn: { full: "English horn", short: "E. hn." },
  bassoon: { full: "Bassoon", short: "Bsn." },
  clarinet: { full: "Clarinet in B♭", short: "Cl." },
  piccolo: { full: "Piccolo", short: "Picc." },
  flute: { full: "Flute", short: "Fl." },
  recorder: { full: "Recorder", short: "Rec." },
  standard_drum_kit: { full: "Drum set", short: "Dr." },
};

const metadataInstrument = /^%\s*abcoda:instrument\s+(\S+)\s+(\S+)\s*$/i;
const metadataBrace = /^%\s*abcoda:brace-group\s+(.+?)\s*$/i;
const scoreDirective = /^(\s*%%(?:score|staves)\s+)(.*)$/i;
const voiceDeclaration = /^(\s*V:\s*)([^\s%]+)(.*)$/i;
const labelProperty = /\s+(?:name|nm|subname|snm)\s*=\s*(?:"(?:[^"\\]|\\.)*"|'[^']*'|[^\s%]+)/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function instrumentLabel(instrument: InstrumentId): ScoreInstrumentLabel {
  return scoreLabels[instrument] ?? {
    full: instrumentDefinition(instrument).label,
    short: instrumentDefinition(instrument).label,
  };
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

function groupInstrument(
  group: readonly string[],
  instruments: InstrumentAssignments,
): InstrumentId | undefined {
  const assigned = group.map((id) => instruments[id]);
  if (assigned.some((instrument) => instrument === undefined)) return undefined;
  const first = assigned[0];
  return first && assigned.every((instrument) => instrument === first) ? first : undefined;
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

/**
 * Synchronizes notation-affecting instrument choices from the widget back into
 * canonical ABC. Voice ids remain implementation ids; printed labels describe
 * instruments or braced instrument groups instead of hands/voices.
 *
 * Simple existing brace groups are remembered in harmless ABC comments so a
 * temporary split (for example piano RH -> cello while LH stays piano) can
 * remove the brace and later restore it when the voices share an instrument
 * again.
 */
export function synchronizeInstrumentationAbc(
  source: string,
  instruments: InstrumentAssignments,
): string {
  const hadFinalNewline = /\r?\n$/.test(source);
  const originalLines = source.replace(/\r\n?/g, "\n").split("\n");

  const previousInstruments: Record<string, InstrumentId> = {};
  const persistedGroups: string[][] = [];
  for (const line of originalLines) {
    const instrumentMatch = metadataInstrument.exec(line);
    if (instrumentMatch && instrumentMatch[1] && instrumentMatch[2]) {
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
  const groups = uniqueGroups([
    ...persistedGroups,
    ...simpleBraceGroups(currentScoreBody),
  ]);

  const lines = originalLines.filter(
    (line) => !metadataInstrument.test(line) && !metadataBrace.test(line),
  );
  const keyIndex = lines.findIndex((line) => /^\s*K\s*:/i.test(line));
  if (keyIndex < 0) return source;

  const headerVoiceIds = lines
    .slice(0, keyIndex)
    .flatMap((line) => {
      const match = voiceDeclaration.exec(line);
      return match?.[2] ? [match[2]] : [];
    });
  if (headerVoiceIds.length === 0) return source;

  const scoreIndex = lines.slice(0, keyIndex).findIndex((line) => scoreDirective.test(line));
  const activeGroups = groups.filter((group) => groupInstrument(group, instruments) !== undefined);

  if (scoreIndex >= 0) {
    const match = scoreDirective.exec(lines[scoreIndex]!);
    if (match) {
      let body = match[2] ?? "";
      for (const group of groups) {
        body = setBraceState(body, group, groupInstrument(group, instruments) !== undefined);
      }
      lines[scoreIndex] = `${match[1]}${body}`;
    }
  }

  const leaderByVoice = new Map<string, string>();
  for (const group of activeGroups) {
    const leader = group[0];
    if (!leader) continue;
    for (const id of group) leaderByVoice.set(id, leader);
  }

  const units: string[][] = [];
  const consumed = new Set<string>();
  for (const id of headerVoiceIds) {
    if (consumed.has(id)) continue;
    const group = activeGroups.find((candidate) => candidate.includes(id));
    if (group) {
      units.push(group);
      group.forEach((voiceId) => consumed.add(voiceId));
    } else {
      units.push([id]);
      consumed.add(id);
    }
  }
  const useSubnames = units.length > 1;

  for (let index = 0; index < keyIndex; index += 1) {
    const line = lines[index]!;
    const match = voiceDeclaration.exec(line);
    if (!match?.[2]) continue;
    const id = match[2];
    const instrument = instruments[id];
    if (!instrument) continue;

    const { core, comment } = splitComment(match[3] ?? "");
    const previousName = readVoiceProperty(core, ["name", "nm"]);
    const previousSubname = readVoiceProperty(core, ["subname", "snm"]);
    const cleaned = stripLabelProperties(core);
    const groupLeader = leaderByVoice.get(id);
    const isFollower = groupLeader !== undefined && groupLeader !== id;
    const changed = previousInstruments[id] !== undefined && previousInstruments[id] !== instrument;
    const label = instrumentLabel(instrument);

    const fullName = isFollower
      ? undefined
      : groupLeader === id || changed || !previousName
        ? label.full
        : previousName;
    const shortName = isFollower || !useSubnames
      ? undefined
      : groupLeader === id || changed || !previousSubname
        ? label.short
        : previousSubname;

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
    ...groups.map((group) => `% abcoda:brace-group ${group.join(" ")}`),
    ...headerVoiceIds.flatMap((id) => instruments[id]
      ? [`% abcoda:instrument ${id} ${instruments[id]}`]
      : []),
  ];
  if (metadata.length > 0) lines.splice(keyIndex, 0, ...metadata);

  let result = lines.join("\n");
  if (!hadFinalNewline) result = result.replace(/\n$/, "");
  return result;
}
