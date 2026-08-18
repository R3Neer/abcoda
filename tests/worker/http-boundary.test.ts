import { SELF } from "cloudflare:test";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { MAX_MCP_BODY_BYTES } from "../../apps/worker/src/http/security";

const allowedOrigin = "https://chatgpt.com";

function isHealthBody(value: unknown): value is { artifactHash: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "artifactHash" in value &&
    typeof value.artifactHash === "string"
  );
}

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

describe("ABCoda v2 Worker HTTP boundary", () => {
  it("serves the independently built widget through the assets binding", async () => {
    const response = await SELF.fetch("https://abcoda.test/");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    await expect(response.text()).resolves.toContain("ABCoda widget laboratory");
  });

  it("reports all versions from the shared manifest", async () => {
    const widget = await SELF.fetch("https://abcoda.test/index.html");
    const widgetBytes = new TextEncoder().encode(await widget.text());
    const expectedHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", widgetBytes))]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    const response = await SELF.fetch("https://abcoda.test/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      name: "ABCoda",
      version: "0.13.0-alpha.1",
      schemaVersion: 2,
      rulesVersion: 4,
      artifactHash: expectedHash,
      status: "ok",
      runtime: "cloudflare-worker",
      mcp: "/mcp",
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Vary")).toContain("Origin");
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Permissions-Policy")).toContain("microphone=()");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");

    const next = await SELF.fetch("https://abcoda.test/health");
    expect(next.headers.get("X-Request-Id")).not.toBe(response.headers.get("X-Request-Id"));
  });

  it("keeps concurrent health and MCP evaluations isolated", async () => {
    const healthResponses = await Promise.all(
      Array.from({ length: 12 }, () => SELF.fetch("https://abcoda.test/health")),
    );
    const healthBodies = await Promise.all(healthResponses.map((response) => response.json()));
    expect(healthResponses.every((response) => response.status === 200)).toBe(true);
    if (!healthBodies.every(isHealthBody)) throw new Error("Health response omitted artifactHash.");
    expect(new Set(healthBodies.map((body) => body.artifactHash))).toHaveLength(1);

    const requests = Array.from({ length: 12 }, (_, index) => ({
      id: 100 + index,
      revision: 1_000 + index,
      title: `Concurrent score ${index}`,
    }));
    const responses = await Promise.all(
      requests.map(({ id, revision, title }) =>
        rpcRequest({
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: {
            name: "validate_score",
            arguments: {
              schemaVersion: 2,
              revision,
              abc: `X:${id}\
T:${title}\
M:4/4\
L:1/4\
K:C\
C D E F|]`,
            },
          },
        }),
      ),
    );
    const bodies = await Promise.all(responses.map((response) => response.json()));

    expect(responses.every((response) => response.status === 200)).toBe(true);
    for (const [index, request] of requests.entries()) {
      expect(bodies[index]).toMatchObject({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          structuredContent: {
            status: "success",
            snapshot: {
              revision: request.revision,
              document: { tuneId: String(request.id), title: request.title },
            },
          },
        },
      });
    }
  });

  it("reflects an explicitly allowed origin instead of using a wildcard", async () => {
    const response = await SELF.fetch("https://abcoda.test/health", {
      headers: { Origin: allowedOrigin },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
    expect(response.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
  });

  it("rejects untrusted and malformed origins", async () => {
    const untrusted = await SELF.fetch("https://abcoda.test/health", {
      headers: { Origin: "https://evil.example" },
    });
    expect(untrusted.status).toBe(403);
    await expect(untrusted.json()).resolves.toMatchObject({
      error: { code: "ORIGIN_NOT_ALLOWED" },
    });

    const malformed = await SELF.fetch("https://abcoda.test/health", {
      headers: { Origin: "not an origin" },
    });
    expect(malformed.status).toBe(403);
    await expect(malformed.json()).resolves.toMatchObject({
      error: { code: "ORIGIN_INVALID" },
    });
  });

  it("rejects a Host header that contradicts the request URL", async () => {
    const response = await SELF.fetch("https://abcoda.test/health", {
      headers: { Host: "evil.example" },
    });
    expect(response.status).toBe(421);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "HOST_MISMATCH" },
    });
  });

  it("handles preflight only for an allowed origin", async () => {
    const response = await SELF.fetch("https://abcoda.test/mcp", {
      method: "OPTIONS",
      headers: { Origin: allowedOrigin },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
  });

  it("rejects methods outside the route contract", async () => {
    const response = await SELF.fetch("https://abcoda.test/mcp", {
      method: "PUT",
    });
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, POST, DELETE, OPTIONS");
  });

  it("rejects a declared body larger than the transport limit", async () => {
    const response = await SELF.fetch("https://abcoda.test/mcp", {
      method: "POST",
      headers: {
        "Content-Length": String(MAX_MCP_BODY_BYTES + 1),
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "REQUEST_TOO_LARGE" },
    });
  });

  it("stops a streamed body that exceeds the transport limit", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_MCP_BODY_BYTES + 1));
        controller.close();
      },
    });
    const response = await SELF.fetch("https://abcoda.test/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "REQUEST_TOO_LARGE" },
    });
  });

  it("serves the validate_score data tool through the real MCP transport", async () => {
    const initialize = await rpcRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "worker-test", version: "1.0.0" },
      },
    });
    expect(initialize.status).toBe(200);
    await expect(initialize.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        serverInfo: { name: "ABCoda", version: "0.13.0-alpha.1" },
      },
    });

    const tools = await rpcRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(tools.status).toBe(200);
    await expect(tools.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      result: {
        tools: [
          {
            name: "prepare_composition",
            annotations: { readOnlyHint: true, destructiveHint: false },
            outputSchema: { type: "object" },
          },
          {
            name: "validate_score",
            annotations: { readOnlyHint: true, destructiveHint: false },
            outputSchema: {
              type: "object",
            },
          },
          {
            name: "render_score",
            annotations: { readOnlyHint: true, destructiveHint: false },
            _meta: {
              ui: { resourceUri: "ui://abcoda/score-schema-2.html" },
            },
          },
        ],
      },
    });

    const composition = await rpcRequest({
      jsonrpc: "2.0",
      id: 21,
      method: "tools/call",
      params: {
        name: "prepare_composition",
        arguments: {
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
        },
      },
    });
    expect(composition.status).toBe(200);
    await expect(composition.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 21,
      result: {
        structuredContent: {
          schemaVersion: 4,
          brief: { styleFamily: "classical", effort: "standard" },
          renderHints: { tempo: 96, meter: "4/4", voiceKinds: { P1: "pitched" } },
        },
      },
    });

    const validation = await rpcRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "validate_score",
        arguments: {
          schemaVersion: 2,
          revision: 12,
          abc: "X:1\
T:Worker integration\
M:4/4\
L:1/4\
K:C\
C D E F|]",
        },
      },
    });
    expect(validation.status).toBe(200);
    await expect(validation.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 3,
      result: {
        structuredContent: {
          status: "success",
          snapshot: {
            schemaVersion: 2,
            revision: 12,
            document: {
              tuneId: "1",
              meter: "4/4",
              key: "C",
              voices: [{ id: "default", kind: "pitched" }],
            },
          },
        },
      },
    });

    const presentation = await rpcRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "render_score",
        arguments: {
          schemaVersion: 2,
          snapshot: {
            schemaVersion: 2,
            revision: 13,
            document: {
              tuneId: "forged-tune-id",
              title: "Forged title",
              voices: [{ id: "forged-voice-id", kind: "unpitched_percussion" }],
              source: {
                format: "abc",
                text: "X:7\
T:Canonical source\
M:4/4\
L:1/4\
K:C\
G A B c|]",
              },
            },
            diagnostics: [],
          },
        },
      },
    });
    expect(presentation.status).toBe(200);
    await expect(presentation.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 4,
      result: {
        structuredContent: {
          status: "success",
          snapshot: {
            revision: 13,
            document: {
              tuneId: "7",
              title: "Canonical source",
              voices: [{ id: "default", kind: "pitched" }],
            },
          },
        },
      },
    });

    const legacyPresentation = await rpcRequest({
      jsonrpc: "2.0",
      id: 41,
      method: "tools/call",
      params: {
        name: "render_score",
        arguments: {
          schemaVersion: 1,
          abc: "X:8\
T:Legacy input\
M:4/4\
L:1/4\
K:C\
C D E F|]",
        },
      },
    });
    expect(legacyPresentation.status).toBe(200);
    await expect(legacyPresentation.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 41,
      result: { isError: true },
    });

    const resource = await rpcRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "resources/read",
      params: { uri: "ui://abcoda/score-schema-2.html" },
    });
    expect(resource.status).toBe(200);
    const resourceBody = await resource.text();
    expect(resourceBody).toContain("ui://abcoda/score-schema-2.html");
    expect(resourceBody).toContain("ABCoda widget laboratory");
    expect(resourceBody).toContain("abcoda/artifactHash");
  });
});
