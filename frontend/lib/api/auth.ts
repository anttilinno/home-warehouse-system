import { apiClient } from "./client";

export interface Session {
  id: string;
  device_info: string;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
  is_current: boolean;
}

export interface CanDeleteResponse {
  can_delete: boolean;
  blocking_workspaces: Array<{ id: string; name: string; slug: string }>;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  date_format: string;
  time_format: string;
  thousand_separator: string;
  decimal_separator: string;
  language: string;
  theme: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileData {
  full_name?: string;
  email?: string;
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

  logout: async () => {
    try {
      // Call backend to clear cookies
      await apiClient.post("/auth/logout");
    } catch {
      // Ignore errors - we still want to clear local state
    }
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

  updateProfile: async (data: UpdateProfileData): Promise<User> => {
    return apiClient.patch<User>("/users/me", data);
  },

  uploadAvatar: async (file: File): Promise<User> => {
    const formData = new FormData();
    formData.append("avatar", file);
    return apiClient.postForm<User>("/users/me/avatar", formData);
  },

  deleteAvatar: async (): Promise<void> => {
    await apiClient.delete("/users/me/avatar");
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.patch("/users/me/password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  getSessions: async (): Promise<Session[]> => {
    return apiClient.get<Session[]>("/users/me/sessions");
  },

  revokeSession: async (sessionId: string): Promise<void> => {
    await apiClient.delete(`/users/me/sessions/${sessionId}`);
  },

  revokeAllOtherSessions: async (): Promise<void> => {
    await apiClient.delete("/users/me/sessions");
  },

  canDeleteAccount: async (): Promise<CanDeleteResponse> => {
    return apiClient.get<CanDeleteResponse>("/users/me/can-delete");
  },

  deleteAccount: async (confirmation: string): Promise<void> => {
    await apiClient.deleteWithBody("/users/me", { confirmation });
    // Clear local state same as logout
    apiClient.setToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("workspace_id");
    }
  },
};
