import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAbcodaServer, widgetUri } from "../server/app";

describe("ABCoda MCP surface", () => {
  const widgetPath = fileURLToPath(new URL("./fixture-widget.html", import.meta.url));
  let server: McpServer;
  let client: Client;

  beforeEach(async () => {
    server = createAbcodaServer(() => fs.readFile(widgetPath, "utf8"));
    client = new Client({ name: "abcoda-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it("advertises stateless planning and rendering tools", async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(2);
    expect(result.tools.find((tool) => tool.name === "prepare_composition")).toMatchObject({
      annotations: { readOnlyHint: true, destructiveHint: false },
    });
    expect(result.tools.find((tool) => tool.name === "render_score")).toMatchObject({
      name: "render_score",
      annotations: { readOnlyHint: true, destructiveHint: false },
      _meta: {
        ui: { resourceUri: widgetUri },
        "openai/outputTemplate": widgetUri,
      },
    });
  });

  it("returns a style-specific typed composition plan", async () => {
    const brief = {
      styleFamily: "baroque",
      styleDetail: "two-part invention",
      form: "invention exposition, episode, return",
      measures: 16,
      meter: "4/4",
      tempo: 84,
      pitchLanguage: "D minor, functional tonal",
      difficulty: "intermediate",
      intent: "performance",
      ensemble: [
        { voiceId: "RH", instrument: "piano right hand", role: "melody", kind: "pitched" },
        { voiceId: "LH", instrument: "piano left hand", role: "countermelody", kind: "pitched" },
      ],
      constraints: ["original subject"],
    };
    const result = await client.callTool({ name: "prepare_composition", arguments: brief });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      brief,
      guidance: { style: expect.arrayContaining([expect.stringContaining("imitation")]) },
    });
    expect(result.content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "text", text: expect.stringContaining("COMPOSITION PROFILE: baroque") }),
    ]));
  });

  it("publishes style-aware composition instructions during MCP initialization", () => {
    const instructions = client.getInstructions();
    expect(instructions).toContain("Apply theory by requested style");
    expect(instructions).toContain("Baroque or Bach-informed");
    expect(instructions).toContain("Pop/rock/funk/R&B");
    expect(instructions?.slice(0, 512)).toContain("prepare_composition");
  });

  it("normalizes a score call into structured content", async () => {
    const result = await client.callTool({
      name: "render_score",
      arguments: {
        abc: "X:1\nT:Test\nM:4/4\nL:1/4\nK:C\nC D E F|",
        playback: { tempo: 72, instruments: { default: "cello" } },
      },
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      schemaVersion: 1,
      voiceIds: ["default"],
      score: {
        abc: expect.stringContaining("Q:1/4=72"),
        playback: { tempo: 72, instruments: { default: "cello" } },
      },
    });
  });

  it("serves the sandboxed UI resource", async () => {
    const result = await client.readResource({ uri: widgetUri });
    expect(result.contents[0]).toMatchObject({ uri: widgetUri });
    expect(result.contents[0]?._meta).toMatchObject({
      ui: {
        domain: "https://abcoda.mud-repo-patcher-mcp-probe.workers.dev",
        prefersBorder: false,
      },
      "openai/widgetPrefersBorder": false,
      "openai/widgetDomain": "https://abcoda.mud-repo-patcher-mcp-probe.workers.dev",
    });
    expect("text" in result.contents[0]! ? result.contents[0].text : "").toContain("ABCoda test widget");
  });
});
