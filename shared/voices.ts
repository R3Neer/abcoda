export function extractVoiceIds(abc: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const voicePattern = /(?:^|\n)\s*V:\s*([^\s%]+)/g;
  const inlinePattern = /\[V:\s*([^\s\]]+)/g;

  for (const pattern of [voicePattern, inlinePattern]) {
    for (const match of abc.matchAll(pattern)) {
      const id = match[1];
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }

  return ids.length > 0 ? ids : ["default"];
}

export function scoreDirectiveVoiceIds(abc: string): string[] {
  const directive = abc.match(/^\s*%%score\s+(.+)$/m)?.[1];
  if (!directive) return [];
  return [...directive.matchAll(/[A-Za-z0-9_.-]+/g)].map((match) => match[0]);
}

export function scoreVoiceOrder(abc: string): string[] {
  const declared = extractVoiceIds(abc);
  const declaredSet = new Set(declared);
  const grouped = scoreDirectiveVoiceIds(abc).filter((voiceId) => declaredSet.has(voiceId));
  return grouped.length > 0 ? [...new Set(grouped)] : declared;
}

export function abcTitle(abc: string): string | undefined {
  return abc.match(/(?:^|\n)\s*T:\s*(.+)/)?.[1]?.trim();
}
