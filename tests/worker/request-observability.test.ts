import { SELF } from "cloudflare:test";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";

interface ToolCallBody {
  readonly result?: {
    readonly _meta?: Record<string, unknown>;
  };
}

async function callTool(
  id: number,
  name: string,
  args: object,
): Promise<{ response: Response; body: ToolCallBody }> {
  const response = await SELF.fetch("https://abcoda.test/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  return { response, body: await response.json() };
}

function expectCorrelated(response: Response, body: ToolCallBody): void {
  const requestId = response.headers.get("X-Request-Id");
  expect(requestId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(body.result?._meta?.["abcoda/requestId"]).toBe(requestId);
}

describe("ABCoda Worker request observability", () => {
  it("correlates prepare, validate and render tool results with their HTTP request", async () => {
    const composition = await callTool(201, "prepare_composition", {
      styleFamily: "classical",
      styleDetail: "late eighteenth-century chamber idiom",
      formFamily: "period",
      form: "parallel period with a varied consequent",
      measures: 8,
      meter: "4/4",
      tempo: 96,
      rhythmicFeel: "straight",
      pitchFramework: "tonal_functional",
      pitchLanguage: "C major with a half cadence and authentic close",
      texture: "melody_accompaniment",
      difficulty: "intermediate",
      effort: "standard",
      intent: "performance",
      ensemble: [{
        voiceId: "P1",
        instrument: "piano",
        family: "keyboard",
        role: "melody",
        kind: "pitched",
      }],
    });
    expect(composition.response.status).toBe(200);
    expectCorrelated(composition.response, composition.body);

    const validation = await callTool(202, "validate_score", {
      schemaVersion: 2,
      revision: 3,
      abc: "X:3\nM:4/4\nL:1/4\nK:C\nC D E F|]",
    });
    expect(validation.response.status).toBe(200);
    expectCorrelated(validation.response, validation.body);

    const render = await callTool(203, "render_score", {
      schemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        revision: 3,
        document: {
          tuneId: "4",
          meter: "4/4",
          key: "C",
          voices: [{ id: "default", kind: "pitched" }],
          source: {
            format: "abc",
            text: "X:4\nM:4/4\nL:1/4\nK:C\nG A B c|]",
          },
        },
        diagnostics: [],
      },
    });
    expect(render.response.status).toBe(200);
    expectCorrelated(render.response, render.body);
  });

  it("keeps correlation metadata on typed invalid score results", async () => {
    const invalid = await callTool(204, "validate_score", {
      schemaVersion: 2,
      revision: 4,
      abc: "not valid ABC",
    });

    expect(invalid.response.status).toBe(200);
    expectCorrelated(invalid.response, invalid.body);
  });
});
