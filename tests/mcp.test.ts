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

  it("advertises one read-only render tool", async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]).toMatchObject({
      name: "render_score",
      annotations: { readOnlyHint: true, destructiveHint: false },
      _meta: { ui: { resourceUri: widgetUri } },
    });
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
      score: { playback: { tempo: 72, instruments: { default: "cello" } } },
    });
  });

  it("serves the sandboxed UI resource", async () => {
    const result = await client.readResource({ uri: widgetUri });
    expect(result.contents[0]).toMatchObject({ uri: widgetUri });
    expect("text" in result.contents[0]! ? result.contents[0].text : "").toContain("ABCoda test widget");
  });
});
