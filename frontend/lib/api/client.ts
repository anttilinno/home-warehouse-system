// In the browser, use the relative /api proxy so any device on the LAN can reach
// the backend without knowing its address. On the server side (SSR/RSC), use the
// absolute URL so Next.js can reach the backend directly.
import { getApiBase } from "./base";

const API_URL = getApiBase();

interface ApiError {
  message?: string;
  detail?: string; // Huma error format
  code?: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

export interface RequestOptions {
  /**
   * Background requests (polling, prefetch) must not yank the user to the
   * login page on 401 — they fail silently with an error instead.
   */
  background?: boolean;
}

class ApiClient {
  private baseUrl: string;
  /**
   * Auth token is kept in memory only for the current page lifetime
   * (transition aid for the few call sites that still attach a Bearer
   * header). It is intentionally NOT persisted to localStorage — HttpOnly
   * cookies are the auth mechanism, and a persisted token is XSS-exfiltratable.
   */
  private token: string | null = null;
  /** Single in-flight refresh, shared by concurrent 401s */
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Proactively purge any token persisted by older app versions.
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("auth_token");
      } catch {
        // Storage unavailable (private mode) - nothing to purge
      }
    }
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken() {
    return this.token;
  }

  /**
   * Attempt to refresh the session once. The /api proxy injects the HttpOnly
   * refresh_token cookie into the body server-side, so an empty POST suffices.
   * Returns true when new auth cookies were issued.
   */
  private async tryRefresh(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        try {
          const res = await fetch(`${this.baseUrl}/auth/refresh`, {
            method: "POST",
            credentials: "include",
          });
          if (!res.ok) return false;
          const data = await res.json().catch(() => null);
          if (data?.token) {
            this.token = data.token;
          }
          return true;
        } catch {
          return false;
        } finally {
          // Allow future refresh attempts after this one settles
          setTimeout(() => {
            this.refreshPromise = null;
          }, 0);
        }
      })();
    }
    return this.refreshPromise;
  }

  /** Clear local auth state and send the user to login. */
  private handleAuthFailure(background: boolean): never {
    this.setToken(null);
    if (typeof window !== "undefined" && !background) {
      localStorage.removeItem("workspace_id");
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  /**
   * Shared response handling for JSON requests and form posts:
   * one 401 strategy (refresh once, retry, then redirect) and one error shape.
   */
  private async fetchWithAuthRetry(
    input: string,
    init: RequestInit,
    background: boolean
  ): Promise<Response> {
    let response = await fetch(input, init);

    if (response.status === 401) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        response = await fetch(input, init);
      }
      if (response.status === 401) {
        this.handleAuthFailure(background);
      }
    }

    return response;
  }

  private async throwResponseError(response: Response, method: string, endpoint: string): Promise<never> {
    const error: ApiError = await response.json().catch(() => ({
      message: `HTTP ${response.status}: ${response.statusText || "Request failed"}`,
    }));
    console.error(`[API] ${method} ${this.baseUrl}${endpoint} → ${response.status}`, error.detail || error.message);
    throw new Error(error.detail || error.message || `HTTP ${response.status}`);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    workspaceId?: string,
    includeStatus = false,
    requestOptions: RequestOptions = {}
  ): Promise<T | ApiResponse<T>> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Include Authorization header for backwards compatibility
    // (cookies are the primary auth mechanism)
    if (this.token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${this.token}`;
    }

    if (workspaceId) {
      (headers as Record<string, string>)["X-Workspace-ID"] = workspaceId;
    }

    const response = await this.fetchWithAuthRetry(
      `${this.baseUrl}${endpoint}`,
      {
        ...options,
        headers,
        credentials: "include", // Send cookies with requests
      },
      requestOptions.background ?? false
    );

    if (!response.ok) {
      await this.throwResponseError(response, options.method || "GET", endpoint);
    }

    // Handle empty responses (204 No Content)
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      if (includeStatus) {
        return { data: undefined as T, status: response.status } as ApiResponse<T>;
      }
      return undefined as T;
    }

    const data = await response.json();

    if (includeStatus) {
      return { data, status: response.status } as ApiResponse<T>;
    }

    return data;
  }

  async get<T>(endpoint: string, workspaceId?: string, requestOptions?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" }, workspaceId, false, requestOptions) as Promise<T>;
  }

  async post<T>(endpoint: string, data?: unknown, workspaceId?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }, workspaceId) as Promise<T>;
  }

  async patch<T>(endpoint: string, data: unknown, workspaceId?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    }, workspaceId) as Promise<T>;
  }

  async delete(endpoint: string, workspaceId?: string): Promise<void> {
    await this.request(endpoint, { method: "DELETE" }, workspaceId);
  }

  async deleteWithBody<T = void>(endpoint: string, data: unknown, workspaceId?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      body: JSON.stringify(data),
    }, workspaceId) as Promise<T>;
  }

  async postForm<T>(endpoint: string, formData: FormData, workspaceId?: string): Promise<T> {
    const headers: HeadersInit = {};

    // Include Authorization header for backwards compatibility
    if (this.token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${this.token}`;
    }

    if (workspaceId) {
      (headers as Record<string, string>)["X-Workspace-ID"] = workspaceId;
    }

    // Note: Do NOT set Content-Type - browser sets it with boundary for multipart
    const response = await this.fetchWithAuthRetry(
      `${this.baseUrl}${endpoint}`,
      {
        method: "POST",
        headers,
        credentials: "include",
        body: formData,
      },
      false
    );

    if (!response.ok) {
      await this.throwResponseError(response, "POST", endpoint);
    }

    return response.json();
  }

  // Methods that include status code in response (for handling 202 Accepted)
  async postWithStatus<T>(endpoint: string, data?: unknown, workspaceId?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }, workspaceId, true) as Promise<ApiResponse<T>>;
  }

  async patchWithStatus<T>(endpoint: string, data: unknown, workspaceId?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    }, workspaceId, true) as Promise<ApiResponse<T>>;
  }

  async deleteWithStatus(endpoint: string, workspaceId?: string): Promise<ApiResponse<void>> {
    return this.request(endpoint, { method: "DELETE" }, workspaceId, true) as Promise<ApiResponse<void>>;
  }
}

export const apiClient = new ApiClient(API_URL);
