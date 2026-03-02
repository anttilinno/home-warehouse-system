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
 * Proxy photo requests to the backend API.
 * This avoids CORS/ORB issues when loading photos in <img> tags
 * and allows next/image to optimize them as same-origin images.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const backendUrl = `${API_URL}/${path.join("/")}`;

  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  const headers: HeadersInit = {};
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

  try {
    const res = await fetch(backendUrl, { headers });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
