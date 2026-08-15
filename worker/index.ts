import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createAbcodaServer } from "../server/app.js";
import widgetHtml from "../dist/widget/index.html";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/") {
      return withCors(new Response(widgetHtml, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }));
    }

    if (url.pathname === "/health") {
      return withCors(
        Response.json({ name: "ABCoda", version: "0.10.0", status: "ok", runtime: "cloudflare-worker", mcp: "/mcp" }),
      );
    }

    if (url.pathname !== "/mcp") {
      return withCors(new Response("Not found", { status: 404 }));
    }

    const server = createAbcodaServer(async () => widgetHtml);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return withCors(await transport.handleRequest(request));
  },
};
