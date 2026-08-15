import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CanonicalAbcCodec } from "@abcoda/abc-codec";
import { EvaluateScore } from "@abcoda/application";
import {
  createBuildManifest,
  evaluateScoreRequestSchema,
  versions,
} from "@abcoda/contracts";

const readFixture = (name: string) =>
  fs.readFile(
    fileURLToPath(
      new URL(`../characterization/fixtures/abc/${name}.abc`, import.meta.url),
    ),
    "utf8",
  );

describe("architecture v2 first vertical slice", () => {
  const evaluate = new EvaluateScore(new CanonicalAbcCodec());

  it("turns one ABC tune into a protocol-neutral revisioned score", async () => {
    const request = evaluateScoreRequestSchema.parse({
      abc: await readFixture("multi-voice"),
      revision: 7,
    });

    const result = evaluate.execute(request);
    expect(result).toMatchObject({
      status: "success",
      score: {
        revision: 7,
        document: {
          tuneId: "1",
          title: "Two voice baseline",
          meter: "4/4",
          key: "C",
          tempo: { beatUnit: "quarter", bpm: 84 },
          voices: [
            { id: "RH", kind: "pitched" },
            { id: "LH", kind: "pitched" },
          ],
          source: { format: "abc" },
        },
        diagnostics: [],
      },
    });
  });

  it("extracts percussion as canonical voice semantics", async () => {
    const result = evaluate.execute({
      abc: await readFixture("percussion"),
      revision: 9,
    });

    expect(result).toMatchObject({
      status: "success",
      score: {
        document: {
          key: "none",
          tempo: { beatUnit: "quarter", bpm: 100 },
          voices: [{ id: "DR", kind: "unpitched_percussion" }],
        },
      },
    });
  });

  it("does not invent a playback tempo when ABC does not express one canonically", () => {
    const absent = evaluate.execute({ abc: "X:1\nK:C\nC4|]", revision: 10 });
    const unsupported = evaluate.execute({
      abc: 'X:1\nQ:"Allegro" 1/8=160\nK:C\nC4|]',
      revision: 11,
    });

    expect(absent).toMatchObject({ status: "success", score: { document: {} } });
    expect(absent.status === "success" && absent.score.document.tempo).toBeUndefined();
    expect(unsupported.status === "success" && unsupported.score.document.tempo).toBeUndefined();
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

  it("rejects mechanically inconsistent ABC after syntactic decoding", () => {
    const result = evaluate.execute({
      abc: "X:1\nM:4/4\nL:1/4\nK:C\nC D E F|C D E|C D E F|]",
      revision: 3,
    });
    expect(result).toMatchObject({
      status: "invalid",
      diagnostics: [{ code: "ABC_MEASURE_DURATION_MISMATCH", severity: "error" }],
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
