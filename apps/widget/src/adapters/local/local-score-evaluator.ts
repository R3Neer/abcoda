import { CanonicalAbcCodec } from "@abcoda/abc-codec";
import { EvaluateScore } from "@abcoda/application";
import { evaluateScoreResultSchema } from "@abcoda/contracts";
import type { DraftEvaluator } from "../../application/draft-session";

export class LocalScoreEvaluator implements DraftEvaluator {
  private readonly useCase = new EvaluateScore(new CanonicalAbcCodec());

  async evaluate(abc: string, revision: number, signal: AbortSignal) {
    signal.throwIfAborted();
    await Promise.resolve();
    signal.throwIfAborted();
    return evaluateScoreResultSchema.parse(this.useCase.execute({ abc, revision }));
  }
}
