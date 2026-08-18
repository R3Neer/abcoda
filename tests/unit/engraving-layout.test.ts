import { describe, expect, it } from "vitest";
import { normalizeEngravingLayoutAbc } from "@abcoda/abc-codec";

describe("engraving layout normalization", () => {
  it("keeps an inline clef change on the same physical line as following music", () => {
    const source = [
      "X:1",
      "T:Clef wrap",
      "M:4/4",
      "L:1/4",
      "V:V1 clef=treble",
      "K:C",
      "[V:V1] C D E F|[K:C clef=bass]",
      "C, D, E, F,|]",
    ].join("\n");

    const normalized = normalizeEngravingLayoutAbc(source);
    expect(normalized).toContain("[K:C clef=bass] C, D, E, F,|]");
    expect(normalized).not.toContain("[K:C clef=bass]\nC,");
    expect(normalized).toHaveLength(source.length);
  });

  it("preserves offsets for CRLF while joining a voice-prefixed continuation", () => {
    const source = "[V:V1] C D E F|[K:C clef=bass]\r\n[V:V1] C, D, E, F,|]";
    const normalized = normalizeEngravingLayoutAbc(source);

    expect(normalized).toBe(
      "[V:V1] C D E F|[K:C clef=bass]  [V:V1] C, D, E, F,|]",
    );
    expect(normalized).toHaveLength(source.length);
  });

  it("does not join a clef change to a following header, directive, comment, or blank line", () => {
    for (const next of ["V:V2 clef=bass", "%%score V1", "% comment", ""]) {
      const source = `[V:V1] C4|[K:C clef=bass]\n${next}`;
      expect(normalizeEngravingLayoutAbc(source)).toBe(source);
    }
  });

  it("leaves an inline clef alone when music already follows it", () => {
    const source = "[V:V1] C4|[K:C clef=bass] C,4|]";
    expect(normalizeEngravingLayoutAbc(source)).toBe(source);
  });
});
