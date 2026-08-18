import { describe, expect, it } from "vitest";
import { scoreVisualClearance } from "../../apps/widget/src/application/score-clearance";

describe("scoreVisualClearance", () => {
  it("adds the visual overflow and a breathing-space buffer", () => {
    expect(scoreVisualClearance(420, 432)).toBe(20);
  });

  it("does not add space for content contained by the SVG", () => {
    expect(scoreVisualClearance(420, 419.8)).toBe(0);
  });

  it("ignores sub-pixel measurement noise", () => {
    expect(scoreVisualClearance(420, 420.4)).toBe(0);
  });
});
