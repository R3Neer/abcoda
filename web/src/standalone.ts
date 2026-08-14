import { renderScoreOutputSchema, type RenderScoreOutput } from "../../shared/score";

const hashPrefix = "#score=";

export function encodeStandaloneScore(output: RenderScoreOutput): string {
  return `${hashPrefix}${encodeURIComponent(JSON.stringify(output))}`;
}

export function decodeStandaloneScore(hash: string): RenderScoreOutput | undefined {
  if (!hash.startsWith(hashPrefix)) return undefined;
  try {
    const parsed = JSON.parse(decodeURIComponent(hash.slice(hashPrefix.length)));
    const result = renderScoreOutputSchema.safeParse(parsed);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}
