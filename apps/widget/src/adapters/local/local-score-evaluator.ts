import {
  CanonicalAbcCodec,
  normalizeEngravingLayoutAbc,
} from "@abcoda/abc-codec";
import { EvaluateScore } from "@abcoda/application";
import { evaluateScoreResultSchema } from "@abcoda/contracts";
import type { DraftEvaluator } from "../../application/draft-session";
import { localEvaluateResultDto } from "./local-score-contract-mapper";

export class LocalScoreEvaluator implements DraftEvaluator {
  private readonly useCase = new EvaluateScore(new CanonicalAbcCodec());

  async evaluate(abc: string, revision: number, signal: AbortSignal) {
    signal.throwIfAborted();
    await Promise.resolve();
    signal.throwIfAborted();
    return evaluateScoreResultSchema.parse(
      localEvaluateResultDto(this.useCase.execute({
        abc: normalizeEngravingLayoutAbc(abc),
        revision,
      })),
    );
  }
}
