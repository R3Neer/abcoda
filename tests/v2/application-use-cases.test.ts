import { describe, expect, it } from "vitest";
import { CanonicalAbcCodec } from "../../packages/abc-codec/src/index";
import {
  EvaluateScore,
  ExportScore,
  PrepareComposition,
  PresentScore,
  type CompositionKnowledge,
} from "../../packages/application/src/index";

interface Brief {
  readonly seed: string;
}

interface Plan {
  readonly sections: readonly string[];
}

describe("transport-independent application use cases", () => {
  it("prepares composition through an injected knowledge port", () => {
    const knowledge: CompositionKnowledge<Brief, Plan> = {
      prepare: (brief) => ({ sections: [`develop:${brief.seed}`, "review"] }),
    };
    const useCase = new PrepareComposition(knowledge);
    expect(useCase.execute({ brief: { seed: "cell-014" } })).toEqual({
      sections: ["develop:cell-014", "review"],
    });
  });

  it("evaluates, presents and exports without MCP, Worker or browser dependencies", () => {
    const codec = new CanonicalAbcCodec();
    const evaluate = new EvaluateScore(codec);
    const evaluated = evaluate.execute({ abc: "X:1\nK:C\nC4|]\n", revision: 4 });
    expect(evaluated.status).toBe("success");
    if (evaluated.status !== "success") throw new Error("Expected evaluation success.");

    const presented = new PresentScore(evaluate).execute({ snapshot: evaluated.snapshot });
    expect(presented).toEqual(evaluated);

    const decoded = codec.decode(evaluated.snapshot.document.source.text);
    if (!decoded.ok) throw new Error("Expected decode success.");
    expect(new ExportScore(codec).execute({ document: decoded.document })).toEqual({
      format: "abc",
      content: "X:1\nK:C\nC4|]\n",
    });
  });
});
