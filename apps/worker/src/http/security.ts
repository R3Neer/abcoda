export const MAX_MCP_BODY_BYTES = 131_072;

export interface RequestBoundary {
  readonly origin?: string;
  readonly rejection?: Response;
}

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

function allowedOrigins(env: Pick<Env, "ALLOWED_ORIGINS">): ReadonlySet<string> {
  return new Set(
    env.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function validateRequestBoundary(
  request: Request,
  env: Pick<Env, "ALLOWED_ORIGINS">,
): RequestBoundary {
  const url = new URL(request.url);
  const host = request.headers.get("Host");
  if (host && host.toLowerCase() !== url.host.toLowerCase()) {
    return {
      rejection: jsonError(421, "HOST_MISMATCH", "The Host header does not match the request URL."),
    };
  }

  const origin = request.headers.get("Origin") ?? undefined;
  if (!origin) return {};

  let normalized: string;
  try {
    normalized = new URL(origin).origin;
  } catch {
    return { rejection: jsonError(403, "ORIGIN_INVALID", "The Origin header is invalid.") };
  }

  if (normalized !== origin || !allowedOrigins(env).has(normalized)) {
    return { rejection: jsonError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.") };
  }

  return { origin: normalized };
}

export function withCors(response: Response, origin?: string): Response {
  const headers = new Headers(response.headers);
  headers.append("Vary", "Origin");
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, MCP-Protocol-Version, Mcp-Session-Id",
    );
    headers.set("Access-Control-Expose-Headers", "Mcp-Session-Id, X-Request-Id");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function boundRequestBody(
  request: Request,
  maximumBytes = MAX_MCP_BODY_BYTES,
): Promise<Request | Response> {
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      return jsonError(400, "CONTENT_LENGTH_INVALID", "Content-Length must be a non-negative integer.");
    }
    if (bytes > maximumBytes) {
      return jsonError(413, "REQUEST_TOO_LARGE", `Request bodies are limited to ${maximumBytes} bytes.`);
    }
  }

  if (!request.body) return request;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel("request body limit exceeded");
      return jsonError(413, "REQUEST_TOO_LARGE", `Request bodies are limited to ${maximumBytes} bytes.`);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(request, { body });
}
