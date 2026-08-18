import {
  instrumentNotation,
  type InstrumentId,
} from "@abcoda/domain";
import {
  synchronizeInstrumentationAbc as synchronizeInstrumentStructure,
  type InstrumentAssignments,
} from "./instrumentation";

const metadataInstrument = /^%\s*abcoda:instrument\s+(\S+)\s+(\S+)\s*$/i;
const scoreDirective = /^\s*%%(?:score|staves)\s+(.+)$/i;
const voiceDeclaration = /^(\s*V:\s*)([^\s%]+)(.*)$/i;
const labelProperty = /\s+(?:name|nm|subname|snm)\s*=\s*(?:"(?:[^"\\]|\\.)*"|'[^']*'|[^\s%]+)/gi;

function quoteLabel(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function splitComment(suffix: string): { core: string; comment: string } {
  const index = suffix.indexOf("%");
  if (index < 0) return { core: suffix, comment: "" };
  return { core: suffix.slice(0, index), comment: suffix.slice(index) };
}

function stripLabels(suffix: string): string {
  return suffix.replace(labelProperty, "").replace(/\s+/g, " ").trim();
}

function braceGroups(scoreBody: string): string[][] {
  return [...scoreBody.matchAll(/\{([^{}()[\]]+)\}/g)].flatMap((match) => {
    const ids = [...(match[1] ?? "").matchAll(/[A-Za-z0-9_.-]+/g)]
      .map((item) => item[0]);
    return ids.length > 1 ? [ids] : [];
  });
}

function unitsForOrder(
  voiceOrder: readonly string[],
  groups: readonly (readonly string[])[],
): string[][] {
  const result: string[][] = [];
  const consumed = new Set<string>();
  for (const id of voiceOrder) {
    if (consumed.has(id)) continue;
    const group = groups.find((candidate) => candidate.includes(id));
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

/**
 * Applies deterministic editorial labels after structural instrument
 * normalization. Printed names are derived exclusively from the finite domain
 * catalog; LLM-provided hand/voice labels are never treated as score policy.
 */
export function synchronizeInstrumentationAbc(
  source: string,
  instruments: InstrumentAssignments,
): string {
  const structured = synchronizeInstrumentStructure(source, instruments);
  const hadFinalNewline = structured.endsWith("\n");
  const lines = structured.replace(/\r\n?/g, "\n").split("\n");
  const keyIndex = lines.findIndex((line) => /^\s*K\s*:/i.test(line));
  if (keyIndex < 0) return structured;

  const normalizedInstruments: Record<string, InstrumentId> = { ...instruments };
  for (const line of lines.slice(0, keyIndex)) {
    const match = metadataInstrument.exec(line);
    if (match?.[1] && match[2]) {
      normalizedInstruments[match[1]] = match[2] as InstrumentId;
    }
  }

  const voiceOrder = lines
    .slice(0, keyIndex)
    .flatMap((line) => {
      const match = voiceDeclaration.exec(line);
      return match?.[2] ? [match[2]] : [];
    });
  if (voiceOrder.length === 0) return structured;

  const scoreBody = lines
    .slice(0, keyIndex)
    .map((line) => scoreDirective.exec(line)?.[1])
    .find((value): value is string => value !== undefined) ?? "";
  const groups = braceGroups(scoreBody);
  const units = unitsForOrder(voiceOrder, groups);
  const useSubnames = units.length > 1;

  const leaderByVoice = new Map<string, string>();
  for (const group of groups) {
    const leader = group[0];
    if (!leader) continue;
    for (const id of group) leaderByVoice.set(id, leader);
  }

  const totals = new Map<string, number>();
  for (const unit of units) {
    const leader = unit[0];
    const instrument = leader ? normalizedInstruments[leader] : undefined;
    if (!instrument) continue;
    const name = instrumentNotation(instrument).name;
    totals.set(name, (totals.get(name) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  const labelsByLeader = new Map<string, { name: string; subname: string }>();
  for (const unit of units) {
    const leader = unit[0];
    const instrument = leader ? normalizedInstruments[leader] : undefined;
    if (!leader || !instrument) continue;
    const policy = instrumentNotation(instrument);
    const total = totals.get(policy.name) ?? 1;
    const ordinal = (seen.get(policy.name) ?? 0) + 1;
    seen.set(policy.name, ordinal);
    const suffix = total > 1 ? ` ${roman(ordinal)}` : "";
    labelsByLeader.set(leader, {
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

    const groupLeader = leaderByVoice.get(id);
    const leader = groupLeader ?? id;
    const isFollower = groupLeader !== undefined && groupLeader !== id;
    const labels = labelsByLeader.get(leader) ?? {
      name: instrumentNotation(instrument).name,
      subname: instrumentNotation(instrument).subname,
    };
    const { core, comment } = splitComment(match[3] ?? "");
    const cleaned = stripLabels(core);

    lines[index] = [
      `${match[1]}${id}`,
      cleaned,
      isFollower ? "" : `name=${quoteLabel(labels.name)}`,
      isFollower || !useSubnames ? "" : `subname=${quoteLabel(labels.subname)}`,
      comment,
    ].filter(Boolean).join(" ");
  }

  let result = lines.join("\n");
  if (!hadFinalNewline) result = result.replace(/\n$/, "");
  return result;
}

export type { InstrumentAssignments };
