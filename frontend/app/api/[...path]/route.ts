import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Server-only: resolves from the Next.js server process, not the browser.
// INTERNAL_API_URL is used in Docker where the backend is reachable via a
// container name. Falls back to the public API URL for local dev.
const API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
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

  const body = request.method !== "GET" && request.method !== "HEAD"
    ? await request.arrayBuffer()
    : undefined;

  const res = await fetch(backendUrl, {
    method: request.method,
    headers: forwardHeaders,
    body: body && body.byteLength > 0 ? body : undefined,
  });

  const responseBody = await res.arrayBuffer();
  const responseHeaders = new Headers();

  const responseContentType = res.headers.get("content-type");
  if (responseContentType) responseHeaders.set("Content-Type", responseContentType);

  // Forward Set-Cookie headers so auth cookies reach the browser
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      responseHeaders.append("Set-Cookie", value);
    }
  });

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
