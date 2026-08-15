import { describe, expect, it } from "vitest";
import { CanonicalDraftTransformer } from "../../apps/widget/src/adapters/local/canonical-draft-transformer";

const mixed = `X:1
T:Mixed
M:4/4
L:1/4
V:P clef=treble
V:D clef=perc
K:C
%%score { P D }
[V:P] C D E F|]
[V:D][K:none clef=perc] C D E F|]`;

describe("CanonicalDraftTransformer", () => {
  it("transposes key and pitched notation while preserving percussion", () => {
    const result = new CanonicalDraftTransformer().transpose(mixed, 2);
    expect(result).toContain("K:D");
    expect(result).toContain("[V:P] D E ^F G|]");
    expect(result).toContain("[V:D][K:none clef=perc] C D E F|]");
  });

  it("is an identity at zero and rejects unsafe intervals", () => {
    const transformer = new CanonicalDraftTransformer();
    expect(transformer.transpose(mixed, 0)).toBe(mixed);
    expect(() => transformer.transpose(mixed, 2.5)).toThrow(/whole number/);
    expect(() => transformer.transpose(mixed, 25)).toThrow(/between -24 and 24/);
  });
});
