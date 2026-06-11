import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Server-only: resolves from the Next.js server process, not the browser.
// INTERNAL_API_URL is used in Docker where the backend is reachable via a
// container name. Falls back to the public API URL for local dev.
const API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Reject path segments that could change the meaning of the proxied URL:
 * empty segments, `.`/`..` traversal, or encoded slashes/backslashes that a
 * downstream URL parser might re-normalize.
 */
function isPathSafe(path: string[]): boolean {
  if (path.length === 0) return false;
  for (const segment of path) {
    if (segment === "" || segment === "." || segment === "..") return false;
    const lower = segment.toLowerCase();
    if (lower.includes("%2f") || lower.includes("%5c") || lower.includes("\\")) {
      return false;
    }
  }
  return true;
}

/**
 * CSRF guard for cookie-authenticated mutations.
 *
 * Browsers always send an Origin header on cross-origin mutating requests,
 * and Sec-Fetch-Site on all requests. Policy:
 * - Sec-Fetch-Site present and not same-origin/none → reject.
 * - Origin present and not matching the request host → reject.
 * - Neither header present (non-browser clients like curl/scripts): only
 *   allowed when the request carries its own Authorization header, since
 *   such clients don't ambient-send our auth cookies and CSRF doesn't apply.
 */
function isCsrfSafe(request: NextRequest): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite) {
    return secFetchSite === "same-origin" || secFetchSite === "none";
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const requestHost = request.headers.get("host") ?? request.nextUrl.host;
      return originUrl.host === requestHost;
    } catch {
      return false;
    }
  }

  // No browser-provided origin metadata: allow only explicit (non-cookie) auth.
  return request.headers.has("authorization");
}

/** Append the connecting client IP to X-Forwarded-For for backend logging. */
function buildForwardedFor(request: NextRequest): string | null {
  const existing = request.headers.get("x-forwarded-for");
  const clientIp = request.headers.get("x-real-ip");
  if (existing && clientIp && !existing.includes(clientIp)) {
    return `${existing}, ${clientIp}`;
  }
  return existing ?? clientIp;
}

function isSSERequest(request: NextRequest, path: string[]): boolean {
  const accept = request.headers.get("accept") ?? "";
  return path[path.length - 1] === "sse" || accept.includes("text/event-stream");
}

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  if (!isPathSafe(path)) {
    return NextResponse.json({ message: "Invalid path" }, { status: 400 });
  }

  if (MUTATING_METHODS.has(request.method) && !isCsrfSafe(request)) {
    return NextResponse.json({ message: "Cross-origin request rejected" }, { status: 403 });
  }

  const joinedPath = path.join("/");
  const search = request.nextUrl.search;
  const backendUrl = `${API_URL}/${joinedPath}${search}`;

  const cookieStore = await cookies();
  const forwardHeaders: Record<string, string> = {};

  // Forward content-type and authorization from the original request
  const contentType = request.headers.get("content-type");
  if (contentType) forwardHeaders["Content-Type"] = contentType;

  const authorization = request.headers.get("authorization");
  if (authorization) forwardHeaders["Authorization"] = authorization;

  // Forward cookies for cookie-based auth
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (cookieHeader) forwardHeaders["Cookie"] = cookieHeader;

  // Forward workspace header if present
  const workspaceId = request.headers.get("x-workspace-id");
  if (workspaceId) forwardHeaders["X-Workspace-ID"] = workspaceId;

  // Forward idempotency key for offline sync deduplication
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) forwardHeaders["Idempotency-Key"] = idempotencyKey;

  // Forward the real client IP so backend session/audit logging doesn't
  // record this Next.js server's address.
  const forwardedFor = buildForwardedFor(request);
  if (forwardedFor) forwardHeaders["X-Forwarded-For"] = forwardedFor;

  let body =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.arrayBuffer()
      : undefined;

  // POST /auth/refresh requires the refresh token in the body, but the
  // browser cannot read the HttpOnly refresh_token cookie. Inject it here
  // server-side when the client sends an empty body.
  if (
    request.method === "POST" &&
    joinedPath === "auth/refresh" &&
    (!body || body.byteLength === 0)
  ) {
    const refreshToken = cookieStore.get("refresh_token")?.value;
    if (refreshToken) {
      body = new TextEncoder().encode(
        JSON.stringify({ refresh_token: refreshToken })
      ).buffer as ArrayBuffer;
      forwardHeaders["Content-Type"] = "application/json";
    }
  }

  const res = await fetch(backendUrl, {
    method: request.method,
    headers: forwardHeaders,
    body: body && body.byteLength > 0 ? body : undefined,
    // Don't follow backend redirects (e.g. OAuth initiate → provider);
    // pass them through to the browser instead.
    redirect: "manual",
  });

  const responseHeaders = new Headers();

  const responseContentType = res.headers.get("content-type");
  if (responseContentType) responseHeaders.set("Content-Type", responseContentType);

  // Pass redirects through to the browser (OAuth flows).
  const location = res.headers.get("location");
  if (location) responseHeaders.set("Location", location);

  // Forward Set-Cookie headers so auth cookies reach the browser
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      responseHeaders.append("Set-Cookie", value);
    }
  });

  // SSE must stream — buffering via arrayBuffer() would hang the request.
  if (isSSERequest(request, path) && res.body && res.ok) {
    responseHeaders.set("Cache-Control", "no-cache, no-transform");
    responseHeaders.set("Connection", "keep-alive");
    responseHeaders.set("X-Accel-Buffering", "no");
    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  }

  const responseBody = await res.arrayBuffer();

  return new NextResponse(responseBody.byteLength > 0 ? responseBody : null, {
    status: res.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, (await params).path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, (await params).path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, (await params).path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, (await params).path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, (await params).path);
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, (await params).path);
}
