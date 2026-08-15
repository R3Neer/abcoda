import { CanonicalAbcCodec } from "../../../../../packages/abc-codec/src/index";
import { EvaluateScore } from "../../../../../packages/application/src/index";
import { evaluateScoreResultSchema } from "../../../../../packages/contracts/src/index";
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
