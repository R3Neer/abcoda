import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("ABC field architecture", () => {
  it("models source-mapped fields in the canonical document", () => {
    const domain = source("packages/domain/src/score.ts");
    expect(domain).toContain("ScoreFieldPlacement");
    expect(domain).toContain("interface ScoreField");
    expect(domain).toContain("valueSource: SourceRange");
    expect(domain).toContain("fields: readonly ScoreField[]");
  });

  it("derives key transposition from parsed fields rather than rescanning source text", () => {
    const operations = source("packages/abc-codec/src/operations.ts");
    expect(operations).toContain("keyFieldReplacements");
    expect(operations).toContain("document.fields");
    expect(operations).not.toContain("function transposeKeys");
    expect(operations).not.toContain("replace(/^K:");
    expect(operations).not.toContain("replace(/\\[K:");
  });
});
