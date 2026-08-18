import { SELF } from "cloudflare:test";
import { evaluateScoreResultSchema } from "@abcoda/contracts";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";

async function rpc(body: object): Promise<unknown> {
  const response = await SELF.fetch("https://abcoda.test/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
    },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  return response.json();
}

function structuredContent(envelope: unknown): unknown {
  if (typeof envelope !== "object" || envelope === null || !("result" in envelope)) {
    return undefined;
  }
  const result = envelope.result;
  if (typeof result !== "object" || result === null || !("structuredContent" in result)) {
    return undefined;
  }
  return result.structuredContent;
}

describe("render_score instrument notation normalization", () => {
  it("repairs stale labels and completes a one-staff piano before publishing the widget result", async () => {
    const abc = `X:1
T:Clarinet and piano
M:4/4
L:1/4
%%score Cl P
V:Cl clef=treble name="Clarinet in B♭" subname="Clarinet in B♭"
V:P clef=treble name="Piano RH"
K:C
[V:Cl name="Clarinet in B♭"] C D E F|]
[V:P name="Piano RH"] G A B c|]`;

    const validationEnvelope = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "validate_score",
        arguments: { schemaVersion: 2, revision: 21, abc },
      },
    });
    const validation = evaluateScoreResultSchema.parse(
      structuredContent(validationEnvelope),
    );
    expect(validation.status).toBe("success");
    expect(validation.snapshot).toBeDefined();
    if (!validation.snapshot) throw new Error("Validation omitted the score snapshot.");

    const renderingEnvelope = await rpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "render_score",
        arguments: {
          schemaVersion: 2,
          snapshot: validation.snapshot,
          presentation: {
            instruments: {
              Cl: "flute",
              P: "acoustic_grand_piano",
            },
          },
        },
      },
    });
    const rendering = evaluateScoreResultSchema.parse(
      structuredContent(renderingEnvelope),
    );

    expect(rendering.status).toBe("success");
    expect(rendering.snapshot?.document.voices).toEqual([
      { id: "Cl", kind: "pitched" },
      { id: "P", kind: "pitched" },
      { id: "P_lower", kind: "pitched" },
    ]);
    const source = rendering.snapshot?.document.source.text;
    expect(source).toBeDefined();
    if (!source) throw new Error("Rendering omitted canonical ABC source.");
    expect(source).toContain("%%score Cl { P | P_lower }");
    expect(source).toContain('V:Cl clef=treble name="Flute" subname="Fl."');
    expect(source).toContain('V:P clef=treble name="Piano" subname="Pno."');
    expect(source).toContain("V:P_lower clef=bass");
    expect(source).toContain("[V:P_lower] z4|]");
    expect(source).not.toContain("Clarinet in B♭");
  });
});
