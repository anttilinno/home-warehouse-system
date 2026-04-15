import type { ApiError } from "./types";

const BASE_URL = "/api";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
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
    return new HttpError(response.status, error.detail || error.message || `HTTP ${response.status}`);
  } catch {
    return new HttpError(
      response.status,
      `HTTP ${response.status}: ${response.statusText || "Request failed"}`
    );
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return undefined as T;
  }
  return response.json();
}

async function doRefresh(): Promise<void> {
  if (!storedRefreshToken) {
    throw new Error("Session expired");
  }
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: storedRefreshToken }),
  });
  if (!res.ok) {
    storedRefreshToken = null;
    throw new Error("Session expired");
  }
  const data = await res.json();
  if (data.refresh_token) {
    storedRefreshToken = data.refresh_token;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
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

export function post<T>(endpoint: string, data?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

export function postMultipart<T>(endpoint: string, form: FormData): Promise<T> {
  return request<T>(endpoint, { method: "POST", body: form });
}

export function patch<T>(endpoint: string, data: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function del<T = void>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: "DELETE" });
}
