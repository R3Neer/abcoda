import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";

const inputUrl = process.argv[2];
if (!inputUrl) {
  throw new Error("Usage: npm run verify:v2-preview -- https://<worker>.<subdomain>.workers.dev");
}

const baseUrl = new URL(inputUrl);
if (baseUrl.protocol !== "https:") {
  throw new Error("The preview URL must use HTTPS.");
}
baseUrl.pathname = "/";
baseUrl.search = "";
baseUrl.hash = "";

const allowedOrigin = "https://chatgpt.com";
const rejectedOrigin = "https://preview-probe.invalid";
const localWidget = await readFile(new URL("../dist/v2-widget/index.html", import.meta.url));
const localArtifactHash = createHash("sha256").update(localWidget).digest("hex");
const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const checks = {};
let rpcId = 100;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requestId(response) {
  const value = response.headers.get("X-Request-Id");
  assert(
    value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
    "Response omitted a valid X-Request-Id.",
  );
  return value;
}

async function jsonResponse(response, label) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} did not return JSON.`);
  }
}

async function rpc(method, params = undefined) {
  rpcId += 1;
  const response = await fetch(new URL("/mcp", baseUrl), {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
      Origin: allowedOrigin,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: rpcId,
      method,
      ...(params === undefined ? {} : { params }),
    }),
  });
  assert(response.status === 200, `${method} returned HTTP ${response.status}.`);
  assert(response.headers.get("Access-Control-Allow-Origin") === allowedOrigin, `${method} lost allowed-origin CORS.`);
  const id = requestId(response);
  const body = await jsonResponse(response, method);
  assert(body.jsonrpc === "2.0" && body.id === rpcId, `${method} returned the wrong JSON-RPC envelope.`);
  assert(!body.error, `${method} returned JSON-RPC error ${JSON.stringify(body.error)}.`);
  return { response, body, requestId: id };
}

const healthResponse = await fetch(new URL("/health", baseUrl), {
  headers: { Origin: allowedOrigin },
});
assert(healthResponse.status === 200, `/health returned HTTP ${healthResponse.status}.`);
const healthRequestId = requestId(healthResponse);
assert(healthResponse.headers.get("Access-Control-Allow-Origin") === allowedOrigin, "/health did not reflect the allowed ChatGPT origin.");
assert(healthResponse.headers.get("Cache-Control") === "no-store", "/health must be no-store.");
assert(healthResponse.headers.get("X-Content-Type-Options") === "nosniff", "/health must set nosniff.");
assert((healthResponse.headers.get("Content-Security-Policy") ?? "").includes("default-src 'none'"), "/health is missing its defensive CSP.");
const health = await jsonResponse(healthResponse, "/health");
assert(health.name === "ABCoda", "/health returned the wrong service name.");
assert(health.status === "ok", "/health is not healthy.");
assert(health.runtime === "cloudflare-worker", "/health is not the Cloudflare Worker runtime.");
assert(typeof health.version === "string" && health.version.length > 0, "/health omitted app version.");
assert(Number.isInteger(health.schemaVersion), "/health omitted schemaVersion.");
assert(Number.isInteger(health.rulesVersion), "/health omitted rulesVersion.");
assert(health.artifactHash === localArtifactHash, `Remote widget hash ${health.artifactHash} does not match local ${localArtifactHash}.`);
checks.health = "ok";
checks.securityHeaders = "ok";

const rejectedResponse = await fetch(new URL("/health", baseUrl), {
  headers: { Origin: rejectedOrigin },
});
assert(rejectedResponse.status === 403, `Untrusted Origin returned HTTP ${rejectedResponse.status} instead of 403.`);
assert(rejectedResponse.headers.get("Access-Control-Allow-Origin") !== rejectedOrigin, "Untrusted Origin was reflected by CORS.");
const rejectedBody = await jsonResponse(rejectedResponse, "untrusted Origin");
assert(rejectedBody.error?.code === "ORIGIN_NOT_ALLOWED", "Untrusted Origin returned the wrong error code.");
checks.originPolicy = "ok";

const initialized = await rpc("initialize", {
  protocolVersion: LATEST_PROTOCOL_VERSION,
  capabilities: {},
  clientInfo: { name: "abcoda-preview-probe", version: "1.0.0" },
});
assert(initialized.body.result?.serverInfo?.name === "ABCoda", "MCP initialize returned the wrong server.");
assert(typeof initialized.body.result?.protocolVersion === "string", "MCP initialize omitted protocolVersion.");
checks.mcpInitialize = "ok";

const tools = await rpc("tools/list");
const toolList = tools.body.result?.tools;
assert(Array.isArray(toolList), "tools/list omitted tools.");
const toolNames = new Set(toolList.map((tool) => tool.name));
for (const name of ["prepare_composition", "validate_score", "render_score"]) {
  assert(toolNames.has(name), `tools/list omitted ${name}.`);
}
const resourceUri = `ui://abcoda/score-schema-${health.schemaVersion}.html`;
const renderTool = toolList.find((tool) => tool.name === "render_score");
assert(renderTool?._meta?.ui?.resourceUri === resourceUri, "render_score points at the wrong UI resource.");
checks.toolsList = "ok";

const privateMarker = "ABCODA_PREVIEW_PRIVATE_MARKER";
const validation = await rpc("tools/call", {
  name: "validate_score",
  arguments: {
    schemaVersion: health.schemaVersion,
    revision: 7001,
    abc: `X:7001\nT:${privateMarker}\nM:4/4\nL:1/4\nK:C\nC D E F|]`,
  },
});
assert(validation.body.result?._meta?.["abcoda/requestId"] === validation.requestId, "validate_score requestId does not match the HTTP request.");
const validationResult = validation.body.result?.structuredContent;
assert(validationResult?.status === "success", "validate_score did not return a successful structured result.");
assert(validationResult.snapshot?.revision === 7001, "validate_score returned the wrong revision.");
checks.validateWithoutUi = "ok";

const rendering = await rpc("tools/call", {
  name: "render_score",
  arguments: {
    schemaVersion: health.schemaVersion,
    snapshot: validationResult.snapshot,
  },
});
assert(rendering.body.result?._meta?.["abcoda/requestId"] === rendering.requestId, "render_score requestId does not match the HTTP request.");
assert(rendering.body.result?.structuredContent?.status === "success", "render_score did not return a successful structured result.");
checks.renderTool = "ok";

const resource = await rpc("resources/read", { uri: resourceUri });
const contents = resource.body.result?.contents;
assert(Array.isArray(contents) && contents.length === 1, "resources/read did not return exactly one widget resource.");
const widget = contents[0];
assert(widget.uri === resourceUri, "resources/read returned the wrong widget URI.");
assert(widget.mimeType === "text/html;profile=mcp-app", `Unexpected widget MIME ${widget.mimeType}.`);
assert(typeof widget.text === "string" && widget.text.length > 100, "Widget resource HTML is missing.");
assert(widget._meta?.["abcoda/artifactHash"] === health.artifactHash, "Widget resource hash differs from /health.");
assert(!widget.text.includes(privateMarker), "Widget HTML leaked score input into the resource template.");
const csp = widget._meta?.ui?.csp;
assert(Array.isArray(csp?.connectDomains), "Widget resource omitted connectDomains.");
assert(csp.connectDomains.length === 1 && csp.connectDomains[0] === "https://paulrosen.github.io", "Widget resource has an unexpected network allowlist.");
assert(Array.isArray(csp.resourceDomains) && csp.resourceDomains.length === 0, "Widget resource unexpectedly allows external static resources.");
checks.widgetResource = "ok";

const report = {
  gitSha,
  baseUrl: baseUrl.origin,
  checkedAt: new Date().toISOString(),
  healthRequestId,
  appVersion: health.version,
  schemaVersion: health.schemaVersion,
  rulesVersion: health.rulesVersion,
  artifactHash: health.artifactHash,
  localArtifactHash,
  checks,
};

const reportUrl = new URL("../dist/v2-preview-validation.json", import.meta.url);
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
