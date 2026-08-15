import { SELF } from "cloudflare:test";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";

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

describe("ABCoda widget resource CSP", () => {
  it("allows only the abcjs soundfont origin for network requests", async () => {
    const response = await rpcRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "resources/read",
      params: { uri: "ui://abcoda/score-schema-2.html" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        contents: [{
          uri: "ui://abcoda/score-schema-2.html",
          _meta: {
            ui: {
              csp: {
                connectDomains: ["https://paulrosen.github.io"],
                resourceDomains: [],
              },
            },
          },
        }],
      },
    });
  });
});
