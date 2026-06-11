/**
 * Single source of truth for the API base URL.
 *
 * - In the browser, ALL requests go through the same-origin `/api` proxy
 *   (`app/api/[...path]/route.ts`). This keeps auth on HttpOnly cookies,
 *   avoids CORS, and lets the service worker scope its caches to one origin.
 * - On the server (SSR/RSC), requests go directly to the backend via
 *   INTERNAL_API_URL (Docker network address) or NEXT_PUBLIC_API_URL.
 *
 * Never read process.env.NEXT_PUBLIC_API_URL directly in fetch call sites —
 * use this helper instead.
 */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    return "/api";
  }
  return (
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000"
  );
}
