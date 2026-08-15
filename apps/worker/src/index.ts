import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { versions } from "../../../packages/contracts/src/index";
import {
  boundRequestBody,
  validateRequestBoundary,
  withCors,
} from "./http/security";
import { createV2McpServer } from "./mcp/create-server";

const allowedMethods: Readonly<Record<string, ReadonlySet<string>>> = {
  "/health": new Set(["GET", "OPTIONS"]),
  "/mcp": new Set(["GET", "POST", "DELETE", "OPTIONS"]),
};

function methodNotAllowed(methods: ReadonlySet<string>): Response {
  return Response.json(
    { error: { code: "METHOD_NOT_ALLOWED", message: "The request method is not allowed for this route." } },
    { status: 405, headers: { Allow: [...methods].join(", ") } },
  );
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const boundary = validateRequestBoundary(request, env);
  if (boundary.rejection) return withCors(boundary.rejection, boundary.origin);

  const url = new URL(request.url);
  const methods = allowedMethods[url.pathname];

  if (!methods) {
    if (request.method !== "GET") {
      return withCors(methodNotAllowed(new Set(["GET"])), boundary.origin);
    }
    return withCors(await env.ASSETS.fetch(request), boundary.origin);
  }

  if (!methods.has(request.method)) {
    return withCors(methodNotAllowed(methods), boundary.origin);
  }

  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }), boundary.origin);
  }

  if (url.pathname === "/health") {
    return withCors(
      Response.json({
        name: "ABCoda",
        version: versions.appVersion,
        schemaVersion: versions.schemaVersion,
        rulesVersion: versions.rulesVersion,
        status: "ok",
        runtime: "cloudflare-worker",
        mcp: "/mcp",
      }),
      boundary.origin,
    );
  }

  const bounded = await boundRequestBody(request);
  if (bounded instanceof Response) return withCors(bounded, boundary.origin);

  const server = createV2McpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(bounded);
  return withCors(response, boundary.origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const requestId = crypto.randomUUID();
      console.error(JSON.stringify({
        event: "request.failed",
        requestId,
        path: new URL(request.url).pathname,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
      return Response.json(
        { error: { code: "INTERNAL_ERROR", message: "The request could not be completed.", requestId } },
        { status: 500 },
      );
    }
  },
} satisfies ExportedHandler<Env>;
