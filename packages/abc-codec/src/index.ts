import type { ScoreCodec } from "../../application/src/index";
import type { DecodeScoreResult, ScoreDocument } from "../../domain/src/index";
import { parseAbc } from "./parser";

export { parseAbc } from "./parser";

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
