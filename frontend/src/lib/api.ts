import type { ApiError } from "./types";

// API client ported verbatim from v2.1:
// - Original (Plan 49-01, commit 3826d24): cookie-JWT + 401 single-flight
//   refresh + per-request helpers.
// - FormData multipart edit (Plan 56-01, commit 4d4c233): isFormData branch
//   omits Content-Type so the browser supplies the multipart boundary;
//   postMultipart helper added; HttpError class introduced with status field.
//
// Locked invariants (do NOT regress without an explicit deviation entry):
//   * Every fetch() carries `credentials: "include"` (cookie-JWT only — no
//     localStorage Bearer tokens; v2.1 Pitfall #10 / v3.0 AP-2).
//   * Module-level `refreshPromise` keeps concurrent 401s on a single in-
//     flight refresh.
//   * isFormData ? {} : { "Content-Type": "application/json" } lets the
//     browser supply multipart boundaries; the refresh endpoint is the only
//     other place "application/json" appears.
//   * BASE_URL = "/api" — Vite proxies to :8080 in dev; same-origin in prod.

const BASE_URL = "/api";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// In-memory refresh token storage (lost on page reload -- access_token cookie survives)
let storedRefreshToken: string | null = null;
let refreshPromise: Promise<void> | null = null;

export function setRefreshToken(token: string | null): void {
  storedRefreshToken = token;
}

export function getRefreshToken(): string | null {
  return storedRefreshToken;
}

async function parseError(response: Response): Promise<HttpError> {
  try {
    const error: ApiError = await response.json();
    return new HttpError(
      response.status,
      error.detail || error.message || `HTTP ${response.status}`,
    );
  } catch {
    return new HttpError(
      response.status,
      `HTTP ${response.status}: ${response.statusText || "Request failed"}`,
    );
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return undefined as unknown as T;
  }
  return response.json();
}

// Signal that the session is gone so a single listener (RequireAuth) can
// redirect to /login. Dispatched only from doRefresh's failure paths, which are
// single-flighted via refreshPromise — so concurrent 401 callers awaiting the
// same promise observe exactly one event (Phase 05 Plan 02, AUTH-01).
function emitAuthExpired(): void {
  if (typeof globalThis.window !== "undefined") {
    globalThis.dispatchEvent(new CustomEvent("auth-expired"));
  }
}

async function doRefresh(): Promise<void> {
  // Throw HttpError(401) — callers (auth guards) distinguish "session is
  // gone" from network failures via instanceof HttpError, and a plain Error
  // here made that check silently miss the most common no-session path.
  if (!storedRefreshToken) {
    emitAuthExpired();
    throw new HttpError(401, "Session expired");
  }
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: storedRefreshToken }),
  });
  if (!res.ok) {
    storedRefreshToken = null;
    emitAuthExpired();
    throw new HttpError(401, "Session expired");
  }
  const data = await res.json();
  if (data.refresh_token) {
    storedRefreshToken = data.refresh_token;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    if (!refreshPromise) {
      refreshPromise = doRefresh();
    }
    try {
      await refreshPromise;
    } catch (err) {
      refreshPromise = null;
      throw err;
    }
    refreshPromise = null;

    const retryResponse = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });
    if (!retryResponse.ok) throw await parseError(retryResponse);
    return parseResponse<T>(retryResponse);
  }

  if (!response.ok) throw await parseError(response);
  return parseResponse<T>(response);
}

export function get<T>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: "GET" });
}

export function post<T>(
  endpoint: string,
  data?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  return request<T>(endpoint, {
    method: "POST",
    body: data === undefined ? undefined : JSON.stringify(data),
    headers,
  });
}

export function postMultipart<T>(endpoint: string, form: FormData): Promise<T> {
  return request<T>(endpoint, { method: "POST", body: form });
}

export function patch<T>(
  endpoint: string,
  data: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  return request<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
    headers,
  });
}

export function del<T = void>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: "DELETE" });
}

// --- Phase 7 Plan 01 additive helpers (do NOT regress the locked invariants
// above — these append only and reuse request()/credentials:"include"). ---

// PUT mirrors patch: JSON-only body, goes through request() so it inherits the
// credentials:"include" + 401 single-flight refresh + retry path. Used by the
// photo set-primary / caption / reorder routes (07-RESEARCH Pitfall 6). JSON
// only — never a FormData body.
export function put<T>(endpoint: string, data: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: "PUT",
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

// Blob download for zip + CSV (07-RESEARCH Pattern 4). Fetches `/api{endpoint}`
// with credentials:"include" (cookie-JWT — never a token in a URL); on non-ok
// throws HttpError(status); else streams the blob to an object-URL anchor click
// and revokes the URL. Does NOT share request()'s refresh path (a blob response
// is not JSON) — kept intentionally simple; downloads are user-initiated and a
// 401 here surfaces as an HttpError the caller can route.
export async function downloadBlob(
  endpoint: string,
  filename: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new HttpError(res.status, `download failed: HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
