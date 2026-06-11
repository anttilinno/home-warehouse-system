import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Server-only: INTERNAL_API_URL is the backend address reachable from this
// container (e.g. http://backend:8080 in Docker). Falls back to the public
// API URL or localhost for local dev.
const API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

/**
 * Reject path segments that could change the meaning of the proxied URL:
 * empty segments, `.`/`..` traversal, or encoded slashes/backslashes.
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
 * Proxy photo requests to the backend API.
 * This avoids CORS/ORB issues when loading photos in <img> tags
 * and allows next/image to optimize them as same-origin images.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  if (!isPathSafe(path)) {
    return new NextResponse(null, { status: 400 });
  }

  const joinedPath = path.join("/");
  // Forward to backend — routes are registered without /api/v1 prefix
  const backendUrl = `${API_URL}/${joinedPath}`;

  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Forward cookies for cookie-based auth
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }

  // Forward conditional request headers so the backend can answer 304
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) headers["If-None-Match"] = ifNoneMatch;
  const ifModifiedSince = request.headers.get("if-modified-since");
  if (ifModifiedSince) headers["If-Modified-Since"] = ifModifiedSince;

  try {
    const res = await fetch(backendUrl, { headers });

    if (res.status === 304) {
      return new NextResponse(null, { status: 304 });
    }

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const body = await res.arrayBuffer();

    const responseHeaders = new Headers({
      "Content-Type": contentType,
      // Photos are workspace-private: `private` keeps shared/CDN caches
      // from serving one user's photo to another.
      "Cache-Control": "private, max-age=31536000",
    });

    // Pass through validators so browsers can revalidate cheaply
    const etag = res.headers.get("etag");
    if (etag) responseHeaders.set("ETag", etag);
    const lastModified = res.headers.get("last-modified");
    if (lastModified) responseHeaders.set("Last-Modified", lastModified);

    return new NextResponse(body, { headers: responseHeaders });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
