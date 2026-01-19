const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiError {
  message: string;
  code?: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage if available (client-side only)
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("auth_token");
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("auth_token", token);
      } else {
        localStorage.removeItem("auth_token");
      }
    }
  }

  getToken() {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    workspaceId?: string,
    includeStatus = false
  ): Promise<T | ApiResponse<T>> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Include Authorization header for backwards compatibility
    // (cookies are now the primary auth mechanism)
    if (this.token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${this.token}`;
    }

    if (workspaceId) {
      (headers as Record<string, string>)["X-Workspace-ID"] = workspaceId;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: "include", // Send cookies with requests
    });

    if (!response.ok) {
      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        // Clear auth state
        this.setToken(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("workspace_id");
          // Redirect to login page
          window.location.href = "/login";
        }
        throw new Error("Session expired. Please log in again.");
      }

      const error: ApiError = await response.json().catch(() => ({
        message: `HTTP ${response.status}: ${response.statusText || "Request failed"}`,
      }));
      throw new Error(error.message || `HTTP ${response.status}`);
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

  async get<T>(endpoint: string, workspaceId?: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" }, workspaceId) as Promise<T>;
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
