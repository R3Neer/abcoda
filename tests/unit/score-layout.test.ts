import { describe, expect, it } from "vitest";
import { scoreStaffWidth } from "../../apps/widget/src/application/score-layout";

describe("scoreStaffWidth", () => {
  it("keeps the default score compact on a wide viewport", () => {
    expect(scoreStaffWidth(1120)).toBe(740);
  });

  it("never asks for more width than the available score area", () => {
    expect(scoreStaffWidth(640)).toBe(560);
  });

  it("uses preferred measures per line to size compact layouts", () => {
    expect(scoreStaffWidth(1120, 2)).toBe(520);
  });

  it("caps wide preferred layouts to the available container", () => {
    expect(scoreStaffWidth(1120, 8)).toBe(1040);
  });

  it("uses a stable fallback before layout has measurable width", () => {
    expect(scoreStaffWidth(0)).toBe(740);
  });
});