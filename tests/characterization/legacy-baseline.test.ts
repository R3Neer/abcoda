import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizeAndLintScore } from "../../shared/abc-lint";
import { createAbcodaServer, widgetUri } from "../../server/app";
import { renderScoreInputSchema } from "../../shared/score";
import { scoreVoiceOrder } from "../../shared/voices";

const fixturePath = (name: string) =>
  fileURLToPath(new URL(`./fixtures/abc/${name}.abc`, import.meta.url));

const readAbc = (name: string) => fs.readFile(fixturePath(name), "utf8");

describe("legacy baseline contracts", () => {
  const widgetPath = fileURLToPath(new URL("../fixture-widget.html", import.meta.url));
  let server: McpServer;
  let client: Client;

  beforeEach(async () => {
    server = createAbcodaServer(() => fs.readFile(widgetPath, "utf8"));
    client = new Client({ name: "abcoda-characterization", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it("fixes the two legacy tool names and their UI boundary", async () => {
    const result = await client.listTools();
    expect(result.tools.map((tool) => tool.name)).toEqual([
      "prepare_composition",
      "render_score",
    ]);

    const prepare = result.tools[0]!;
    expect(prepare.inputSchema).toMatchObject({
      type: "object",
      required: [
        "styleFamily",
        "form",
        "measures",
        "meter",
        "tempo",
        "pitchLanguage",
        "difficulty",
        "intent",
        "ensemble",
      ],
      properties: {
        formFamily: expect.any(Object),
        pitchFramework: expect.any(Object),
        effort: expect.any(Object),
      },
    });

    const render = result.tools[1]!;
    expect(render.inputSchema).toMatchObject({
      type: "object",
      required: ["abc"],
      properties: {
        schemaVersion: expect.any(Object),
        abc: expect.any(Object),
        composition: expect.any(Object),
        playback: expect.any(Object),
        notation: expect.any(Object),
        display: expect.any(Object),
      },
    });
    expect(render._meta).toMatchObject({
      ui: { resourceUri: widgetUri },
      "openai/outputTemplate": widgetUri,
    });
  });

  it.each([
    ["single-voice", ["default"]],
    ["multi-voice", ["RH", "LH"]],
    ["percussion", ["DR"]],
    ["octave-clef", ["G"]],
    ["inline-clef", ["V1"]],
  ])("accepts the %s corpus fixture", async (name, expectedVoices) => {
    const abc = await readAbc(name);
    const parsed = renderScoreInputSchema.parse({ abc });
    const result = normalizeAndLintScore(parsed);
    expect(scoreVoiceOrder(result.score.abc)).toEqual(expectedVoices);
  });

  it("documents the legacy multi-tune corruption without approving it for v2", async () => {
    const abc = await readAbc("legacy-tunebook");
    const parsed = renderScoreInputSchema.parse({ abc });
    const result = normalizeAndLintScore(parsed);

    expect(scoreVoiceOrder(result.score.abc)).toEqual(["A", "B"]);
    expect(result.score.abc).toContain("%%score { A B }");
    expect(result.warnings).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/multiple|tune.?book|X:/i)]),
    );
  });
});
