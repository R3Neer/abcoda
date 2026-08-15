import { describe, expect, it } from "vitest";
import { inferVoiceKind, setVoiceKind, transposeAbc } from "../shared/abc-edit";

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

describe("ABC editing", () => {
  it("transposes pitched notation, key, and sound symbols while preserving percussion", () => {
    const transposed = transposeAbc(mixed, 2);
    expect(transposed).toContain("K:D");
    expect(transposed).toContain("[V:P] D E F G|]");
    expect(transposed).toContain("[V:D][K:none clef=perc] C D E F|]");
  });

  it("changes a pitched voice to explicit percussion notation", () => {
    const changed = setVoiceKind(mixed, "P", "unpitched_percussion");
    expect(changed).toContain("V:P clef=perc");
    expect(changed).toContain("[V:P][K:none clef=perc] C D E F|]");
    expect(inferVoiceKind(changed, "P")).toBe("unpitched_percussion");
  });

  it("changes percussion back to pitched notation in the score key", () => {
    const changed = setVoiceKind(mixed, "D", "pitched");
    expect(changed).toContain("V:D clef=treble");
    expect(changed).toContain("[V:D][K:C clef=treble] C D E F|]");
    expect(inferVoiceKind(changed, "D")).toBe("pitched");
  });

  it("converts an implicit single voice without inventing a V identifier", () => {
    const plain = "X:1\nT:Solo\nM:4/4\nL:1/4\nK:G\nGABc|]";
    const percussion = setVoiceKind(plain, "default", "unpitched_percussion");
    expect(percussion).toContain("K:none clef=perc");
    expect(percussion).not.toContain("V:default");
    expect(inferVoiceKind(percussion, "default")).toBe("unpitched_percussion");
    expect(setVoiceKind(percussion, "default", "pitched", "G")).toContain("K:G clef=treble");
  });

  it("rejects invalid transposition ranges", () => {
    expect(() => transposeAbc(mixed, 2.5)).toThrow();
    expect(() => transposeAbc(mixed, 25)).toThrow();
  });
});
