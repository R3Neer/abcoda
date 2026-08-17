import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("composition package architecture", () => {
  it("keeps the public index as a barrel rather than a knowledge monolith", () => {
    const index = read("packages/composition/src/index.ts");
    expect(index).toContain("./schema.js");
    expect(index).toContain("./planner.js");
    expect(index).toContain("./instructions.js");
    expect(index).not.toContain("const styleGuidance");
    expect(index).not.toContain("const styleReviewGuidance");
    expect(index).not.toContain("function reviewSection");
    expect(index).not.toContain("function renderPrompt");
  });

  it("separates schema, generation catalogs, review catalogs, performance policy and planner", () => {
    const schema = read("packages/composition/src/schema.ts");
    const guidance = read("packages/composition/src/catalogs/guidance.ts");
    const review = read("packages/composition/src/catalogs/review.ts");
    const performance = read("packages/composition/src/performance-policy.ts");
    const planner = read("packages/composition/src/planner.ts");

    expect(schema).toContain("compositionBriefSchema");
    expect(schema).toContain("compositionPlanOutputSchema");
    expect(schema).not.toContain("styleGuidance");
    expect(schema).not.toContain("buildCompositionPlan");

    expect(guidance).toContain("styleGuidance");
    expect(guidance).toContain("instrumentGuidance");
    expect(guidance).not.toContain("styleReviewGuidance");
    expect(guidance).not.toContain("buildCompositionPlan");

    expect(review).toContain("styleReviewGuidance");
    expect(review).toContain("effortReviewGuidance");
    expect(review).not.toContain("styleGuidance:");
    expect(review).not.toContain("buildCompositionPlan");

    expect(performance).toContain("expressiveNotationGuidance");
    expect(performance).toContain("expressiveReviewGuidance");
    expect(performance).not.toContain("buildCompositionPlan");

    expect(planner).toContain("buildCompositionPlan");
    expect(planner).toContain("reviewSection");
  });

  it("keeps module dependencies pointing toward schema/catalog leaves", () => {
    const schema = read("packages/composition/src/schema.ts");
    const guidance = read("packages/composition/src/catalogs/guidance.ts");
    const review = read("packages/composition/src/catalogs/review.ts");
    const performance = read("packages/composition/src/performance-policy.ts");

    expect(schema).not.toContain("./planner");
    expect(schema).not.toContain("./catalogs/");
    expect(schema).not.toContain("./performance-policy");
    expect(guidance).not.toContain("planner");
    expect(guidance).not.toContain("review.js");
    expect(review).not.toContain("planner");
    expect(review).not.toContain("guidance.js");
    expect(performance).not.toContain("planner");
  });
});
