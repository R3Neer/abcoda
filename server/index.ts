import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createAbcodaServer } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const widgetPath = path.resolve(currentDir, "../../widget/index.html");

const httpServer = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, MCP-Protocol-Version, Mcp-Session-Id");
  response.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  if (request.url === "/" || request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ name: "ABCoda", status: "ok", mcp: "/mcp" }));
    return;
  }

  if (request.url !== "/mcp") {
    response.writeHead(404).end("Not found");
    return;
  }

  const server = createAbcodaServer(() => fs.readFile(widgetPath, "utf8"));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  response.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(request, response);
});

httpServer.listen(port, () => {
  console.log(`ABCoda MCP server listening on http://localhost:${port}/mcp`);
});
