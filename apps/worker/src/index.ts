import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { loadWidgetArtifact } from "./assets/widget-artifact";
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

interface RequestContext {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly startedAt: number;
}

function requestContext(request: Request): RequestContext {
  return {
    id: crypto.randomUUID(),
    method: request.method,
    path: new URL(request.url).pathname,
    startedAt: Date.now(),
  };
}

function finalizeResponse(response: Response, context: RequestContext): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", context.id);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  if (context.path === "/mcp" || context.path === "/health") {
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

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
    const artifact = await loadWidgetArtifact(env, request.url);
    return withCors(
      Response.json({
        name: "ABCoda",
        version: artifact.manifest.appVersion,
        schemaVersion: artifact.manifest.schemaVersion,
        rulesVersion: artifact.manifest.rulesVersion,
        artifactHash: artifact.manifest.artifactHash,
        status: "ok",
        runtime: "cloudflare-worker",
        mcp: "/mcp",
      }),
      boundary.origin,
    );
  }

  const bounded = await boundRequestBody(request);
  if (bounded instanceof Response) return withCors(bounded, boundary.origin);

  const server = createV2McpServer(() => loadWidgetArtifact(env, request.url));
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(bounded);
  return withCors(response, boundary.origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const context = requestContext(request);
    try {
      const response = finalizeResponse(await handleRequest(request, env), context);
      console.log({
        event: "request.completed",
        requestId: context.id,
        method: context.method,
        path: context.path,
        status: response.status,
        durationMs: Date.now() - context.startedAt,
      });
      return response;
    } catch (error) {
      console.error({
        event: "request.failed",
        requestId: context.id,
        method: context.method,
        path: context.path,
        durationMs: Date.now() - context.startedAt,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return finalizeResponse(
        Response.json(
          { error: { code: "INTERNAL_ERROR", message: "The request could not be completed.", requestId: context.id } },
          { status: 500 },
        ),
        context,
      );
    }
  },
} satisfies ExportedHandler<Env>;
