import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BaselineAbcCodec } from "../../packages/abc-codec/src/index";
import { EvaluateScore } from "../../packages/application/src/index";
import {
  createBuildManifest,
  evaluateScoreRequestSchema,
  versions,
} from "../../packages/contracts/src/index";

const readFixture = (name: string) =>
  fs.readFile(
    fileURLToPath(
      new URL(`../characterization/fixtures/abc/${name}.abc`, import.meta.url),
    ),
    "utf8",
  );

describe("architecture v2 first vertical slice", () => {
  const evaluate = new EvaluateScore(new BaselineAbcCodec());

  it("turns one ABC tune into a revisioned domain snapshot", async () => {
    const request = evaluateScoreRequestSchema.parse({
      abc: await readFixture("multi-voice"),
      revision: 7,
    });

    const result = evaluate.execute(request);
    expect(result).toMatchObject({
      status: "success",
      snapshot: {
        schemaVersion: 2,
        revision: 7,
        document: {
          tuneId: "1",
          title: "Two voice baseline",
          voiceIds: ["RH", "LH"],
          source: { format: "abc" },
        },
        diagnostics: [],
      },
    });
  });

  it("rejects a tunebook instead of merging voices across tunes", async () => {
    const result = evaluate.execute({
      abc: await readFixture("legacy-tunebook"),
      revision: 8,
    });

    expect(result).toMatchObject({
      status: "invalid",
      diagnostics: [
        {
          code: "ABC_MULTIPLE_TUNES_UNSUPPORTED",
          severity: "error",
          range: { start: { line: 7, column: 1 } },
        },
      ],
    });
  });

  it("rejects missing and empty tune references with stable codes", () => {
    expect(evaluate.execute({ abc: "T:No reference\nK:C\nC4|]", revision: 1 })).toMatchObject({
      status: "invalid",
      diagnostics: [{ code: "ABC_TUNE_REFERENCE_MISSING" }],
    });
    expect(evaluate.execute({ abc: "X:\nT:Empty reference\nK:C\nC4|]", revision: 2 })).toMatchObject({
      status: "invalid",
      diagnostics: [{ code: "ABC_TUNE_REFERENCE_INVALID" }],
    });
  });

  it("keeps versions centralized and requires a real artifact digest", () => {
    expect(versions).toEqual({
      appVersion: "0.13.0-alpha.1",
      schemaVersion: 2,
      rulesVersion: 4,
    });
    expect(createBuildManifest("ABCDEF12")).toEqual({
      ...versions,
      artifactHash: "abcdef12",
    });
    expect(() => createBuildManifest("dev")).toThrow(/artifactHash/);
  });
});
