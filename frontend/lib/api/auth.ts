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

export interface LoginResponse {
  access_token: string;
  user: User;
  workspaces: Workspace[];
  token_type: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  language?: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/auth/login", {
      email,
      password,
    });
    apiClient.setToken(response.access_token);
    return response;
  },

  register: async (data: RegisterData): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/auth/register", data);
    apiClient.setToken(response.access_token);
    return response;
  },

  logout: () => {
    apiClient.setToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("workspace_id");
    }
  },

  getMe: async (): Promise<User> => {
    return apiClient.get<User>("/auth/me");
  },

  getWorkspaces: async (): Promise<Workspace[]> => {
    return apiClient.get<Workspace[]>("/auth/me/workspaces");
  },
};
