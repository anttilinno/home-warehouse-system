import { apiClient } from "./client";

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  date_format: string;
  language: string;
  theme: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: string;
  is_personal: boolean;
}

export interface AuthTokenResponse {
  token: string;
  refresh_token: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  language?: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<AuthTokenResponse> => {
    const response = await apiClient.post<AuthTokenResponse>("/auth/login", {
      email,
      password,
    });
    apiClient.setToken(response.token);
    return response;
  },

  register: async (data: RegisterData): Promise<AuthTokenResponse> => {
    const response = await apiClient.post<AuthTokenResponse>("/auth/register", data);
    apiClient.setToken(response.token);
    return response;
  },

  logout: () => {
    apiClient.setToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("workspace_id");
    }
  },

  getMe: async (): Promise<User> => {
    return apiClient.get<User>("/users/me");
  },

  getWorkspaces: async (): Promise<Workspace[]> => {
    return apiClient.get<Workspace[]>("/users/me/workspaces");
  },
};
