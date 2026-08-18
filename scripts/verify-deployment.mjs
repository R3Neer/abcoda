import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";

const inputUrl = process.argv[2];
if (!inputUrl) {
  throw new Error("Usage: npm run verify:deployment -- https://<worker>.<subdomain>.workers.dev");
}

const baseUrl = new URL(inputUrl);
if (baseUrl.protocol !== "https:") {
  throw new Error("The deployment URL must use HTTPS.");
}
baseUrl.pathname = "/";
baseUrl.search = "";
baseUrl.hash = "";

const allowedOrigin = "https://chatgpt.com";
const rejectedOrigin = "https://preview-probe.invalid";
const deploymentReadinessTimeoutMs = 60_000;
const deploymentReadinessPollMs = 2_000;
const localWidget = await readFile(new URL("../dist/widget/index.html", import.meta.url));
const localArtifactHash = createHash("sha256").update(localWidget).digest("hex");
const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const checks = {};
let rpcId = 100;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requestId(response) {
  const value = response.headers.get("X-Request-Id");
  assert(value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value), "Response omitted a valid X-Request-Id.");
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
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId, method, ...(params === undefined ? {} : { params }) }),
  });
  assert(response.status === 200, `${method} returned HTTP ${response.status}.`);
  assert(response.headers.get("Access-Control-Allow-Origin") === allowedOrigin, `${method} lost allowed-origin CORS.`);
  const id = requestId(response);
  const body = await jsonResponse(response, method);
  assert(body.jsonrpc === "2.0" && body.id === rpcId, `${method} returned the wrong JSON-RPC envelope.`);
  assert(!body.error, `${method} returned JSON-RPC error ${JSON.stringify(body.error)}.`);
  return { response, body, requestId: id };
}

async function waitForExpectedHealthArtifact() {
  const deadline = Date.now() + deploymentReadinessTimeoutMs;
  let attempt = 0;
  let lastObserved = "no response";

  while (true) {
    attempt += 1;
    try {
      const response = await fetch(new URL("/health", baseUrl), {
        headers: {
          "Cache-Control": "no-cache",
          Origin: allowedOrigin,
        },
      });
      if (response.status === 200) {
        const id = requestId(response);
        const health = await jsonResponse(response, "/health");
        lastObserved = `widget hash ${health.artifactHash ?? "missing"}`;
        if (health.artifactHash === localArtifactHash) {
          return { response, health, requestId: id };
        }
      } else {
        lastObserved = `HTTP ${response.status}`;
      }
    } catch (error) {
      lastObserved = error instanceof Error ? error.message : String(error);
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `Deployment did not expose local widget hash ${localArtifactHash} within ${deploymentReadinessTimeoutMs / 1000}s; last observed ${lastObserved}.`,
      );
    }

    process.stdout.write(
      `Deployment readiness attempt ${attempt}: observed ${lastObserved}; waiting for widget hash ${localArtifactHash}.\n`,
    );
    await delay(deploymentReadinessPollMs);
  }
}

const {
  response: healthResponse,
  health,
  requestId: healthRequestId,
} = await waitForExpectedHealthArtifact();
assert(healthResponse.status === 200, `/health returned HTTP ${healthResponse.status}.`);
assert(healthResponse.headers.get("Access-Control-Allow-Origin") === allowedOrigin, "/health did not reflect the allowed ChatGPT origin.");
assert(healthResponse.headers.get("Cache-Control") === "no-store", "/health must be no-store.");
assert(healthResponse.headers.get("X-Content-Type-Options") === "nosniff", "/health must set nosniff.");
assert((healthResponse.headers.get("Content-Security-Policy") ?? "").includes("default-src 'none'"), "/health is missing its defensive CSP.");
assert(health.name === "ABCoda", "/health returned the wrong service name.");
assert(health.status === "ok", "/health is not healthy.");
assert(health.runtime === "cloudflare-worker", "/health is not the Cloudflare Worker runtime.");
assert(typeof health.version === "string" && health.version.length > 0, "/health omitted app version.");
assert(Number.isInteger(health.schemaVersion), "/health omitted schemaVersion.");
assert(Number.isInteger(health.rulesVersion), "/health omitted rulesVersion.");
assert(health.artifactHash === localArtifactHash, `Remote widget hash ${health.artifactHash} does not match local ${localArtifactHash}.`);
checks.health = "ok";
checks.securityHeaders = "ok";

const rejectedResponse = await fetch(new URL("/health", baseUrl), { headers: { Origin: rejectedOrigin } });
assert(rejectedResponse.status === 403, `Untrusted Origin returned HTTP ${rejectedResponse.status} instead of 403.`);
assert(rejectedResponse.headers.get("Access-Control-Allow-Origin") !== rejectedOrigin, "Untrusted Origin was reflected by CORS.");
const rejectedBody = await jsonResponse(rejectedResponse, "untrusted Origin");
assert(rejectedBody.error?.code === "ORIGIN_NOT_ALLOWED", "Untrusted Origin returned the wrong error code.");
checks.originPolicy = "ok";

const initialized = await rpc("initialize", {
  protocolVersion: LATEST_PROTOCOL_VERSION,
  capabilities: {},
  clientInfo: { name: "abcoda-deployment-probe", version: "1.0.0" },
});
assert(initialized.body.result?.serverInfo?.name === "ABCoda", "MCP initialize returned the wrong server.");
assert(typeof initialized.body.result?.protocolVersion === "string", "MCP initialize omitted protocolVersion.");
checks.mcpInitialize = "ok";

const tools = await rpc("tools/list");
const toolList = tools.body.result?.tools;
assert(Array.isArray(toolList), "tools/list omitted tools.");
const expectedToolNames = ["prepare_composition", "render_score", "validate_score"];
const actualToolNames = toolList.map((tool) => tool.name).sort();
assert(JSON.stringify(actualToolNames) === JSON.stringify(expectedToolNames), `tools/list returned unexpected tools ${JSON.stringify(actualToolNames)}.`);
const toolsAgain = await rpc("tools/list");
assert(JSON.stringify(toolsAgain.body.result?.tools) === JSON.stringify(toolList), "Two consecutive tools/list calls returned different tool definitions.");
const resourceUri = `ui://abcoda/score-schema-${health.schemaVersion}.html`;
const renderTool = toolList.find((tool) => tool.name === "render_score");
assert(renderTool?._meta?.ui?.resourceUri === resourceUri, "render_score points at the wrong UI resource.");
assert(renderTool?.inputSchema?.type === "object", "render_score must expose one object schema, not a union.");
const renderProperties = renderTool.inputSchema?.properties ?? {};
assert("snapshot" in renderProperties, "render_score input omitted the score snapshot.");
for (const legacyProperty of ["abc", "composition", "playback", "notation", "display"]) {
  assert(!(legacyProperty in renderProperties), `render_score still exposes legacy property ${legacyProperty}.`);
}
checks.toolsList = "ok";

const privateMarker = "ABCODA_DEPLOYMENT_PRIVATE_MARKER";
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
  arguments: { schemaVersion: health.schemaVersion, snapshot: validationResult.snapshot },
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
const expectedWidgetDomain = baseUrl.origin;
assert(widget._meta?.ui?.domain === expectedWidgetDomain, `Widget resource domain ${widget._meta?.ui?.domain} does not match ${expectedWidgetDomain}.`);
assert(widget._meta?.["openai/widgetDomain"] === expectedWidgetDomain, "Widget resource omitted the ChatGPT widgetDomain compatibility alias.");
const csp = widget._meta?.ui?.csp;
assert(Array.isArray(csp?.connectDomains), "Widget resource omitted connectDomains.");
assert(csp.connectDomains.length === 1 && csp.connectDomains[0] === "https://paulrosen.github.io", "Widget resource has an unexpected network allowlist.");
assert(Array.isArray(csp.resourceDomains) && csp.resourceDomains.length === 0, "Widget resource unexpectedly allows external static resources.");
checks.widgetResource = "ok";
checks.widgetDomain = "ok";

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

const reportUrl = new URL("../dist/deployment-validation.json", import.meta.url);
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
