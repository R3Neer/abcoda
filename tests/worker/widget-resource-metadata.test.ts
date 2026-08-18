import { SELF } from "cloudflare:test";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";

const widgetDomain = "https://abcoda.mud-repo-patcher-mcp-probe.workers.dev";
const widgetResourceUri = "ui://abcoda/score-schema-2.html";

async function rpcRequest(body: object): Promise<Response> {
  return SELF.fetch("https://abcoda.test/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
    },
    body: JSON.stringify(body),
  });
}

describe("ABCoda widget resource metadata", () => {
  it("declares the dedicated widget domain and narrow SoundFont CSP", async () => {
    const response = await rpcRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "resources/read",
      params: { uri: widgetResourceUri },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        contents: [{
          uri: widgetResourceUri,
          _meta: {
            ui: {
              domain: widgetDomain,
              csp: {
                connectDomains: ["https://paulrosen.github.io"],
                resourceDomains: [],
              },
            },
            "openai/widgetDomain": widgetDomain,
          },
        }],
      },
    });
  });
});
