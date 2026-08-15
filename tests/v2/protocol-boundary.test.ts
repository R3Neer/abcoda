import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("score protocol boundary", () => {
  it("keeps external schema versioning out of the domain score model", () => {
    const domain = source("packages/domain/src/score.ts");
    expect(domain).toContain("RevisionedScore");
    expect(domain).toContain("ScoreProjection");
    expect(domain).not.toContain("schemaVersion");
    expect(domain).not.toContain("ScoreSnapshot");
    expect(domain).not.toContain("@abcoda/contracts");
  });

  it("keeps application independent of external contracts", () => {
    const application = source("packages/application/src/index.ts");
    expect(application).not.toContain("@abcoda/contracts");
    expect(application).not.toContain("schemaVersion");
    expect(application).toContain("RevisionedScore");
  });

  it("maps protocol DTOs only in edge adapters", () => {
    const workerMapper = source("apps/worker/src/mcp/score-contract-mapper.ts");
    const localMapper = source("apps/widget/src/adapters/local/local-score-contract-mapper.ts");
    expect(workerMapper).toContain("schemaVersion: 2");
    expect(localMapper).toContain("schemaVersion: 2");
    expect(workerMapper).toContain("toScoreSnapshotDto");
    expect(workerMapper).toContain("fromScoreSnapshotDto");
  });
});
