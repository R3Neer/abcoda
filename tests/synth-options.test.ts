import { describe, expect, it } from "vitest";
import { hiddenSynthVisualOptions } from "../web/src/synth-options";

describe("hidden abcjs controls", () => {
  it("creates abcjs's hidden warp input so live tempo changes cannot dereference null", () => {
    expect(hiddenSynthVisualOptions).toMatchObject({
      displayLoop: false,
      displayPlay: false,
      displayProgress: false,
      displayRestart: false,
      displayWarp: true,
    });
  });
});
