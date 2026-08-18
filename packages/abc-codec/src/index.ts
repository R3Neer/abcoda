import type { ScoreCodec } from "@abcoda/application";
import type { DecodeScoreResult, ScoreDocument } from "@abcoda/domain";
import { parseAbc } from "./parser";

export { parseAbc } from "./parser";
export * from "./operations";
export {
  synchronizeInstrumentationAbc,
  type InstrumentAssignments,
} from "./canonical-instrumentation";
export { validateScore } from "./validation";

/**
 * Lossless serialization is the safe baseline for the canonical model: until a
 * score operation intentionally edits the aggregate, comments, layout hints and
 * unsupported ABC constructs remain byte-for-byte stable after newline
 * normalization.
 */
export function serializeAbc(document: ScoreDocument): string {
  return document.source.text.replace(/\r\n?/g, "\n");
}

export class CanonicalAbcCodec implements ScoreCodec {
  decode(input: string): DecodeScoreResult {
    return parseAbc(input);
  }

  encode(document: ScoreDocument): string {
    return serializeAbc(document);
  }
}
