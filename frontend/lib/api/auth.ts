import { apiClient } from "./client";
import { deleteDB } from "@/lib/db/offline-db";

/**
 * Purge all locally persisted user data. Called on logout (and account
 * deletion) so the next browser user cannot read the previous user's
 * inventory from Cache Storage or IndexedDB.
 */
async function purgeLocalData(): Promise<void> {
  if (typeof window === "undefined") return;

  // 1. Service worker runtime caches (api-cache + photo caches + any future
  //    runtime cache; enumerate instead of hardcoding names).
  if ("caches" in window) {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    } catch (error) {
      console.warn("[Auth] Failed to purge SW caches:", error);
    }
  }

  // 2. Offline IndexedDB (items, inventory, mutationQueue, photo blobs, ...)
  try {
    await deleteDB();
  } catch (error) {
    console.warn("[Auth] Failed to delete offline database:", error);
  }

  // 3. The service worker's private photo upload queue DB
  if (typeof indexedDB !== "undefined") {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("PhotoUploadQueue");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  }
}

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

export interface NotificationPreferences {
  enabled?: boolean;
  loans?: boolean;
  inventory?: boolean;
  workspace?: boolean;
  system?: boolean;
  [key: string]: boolean | undefined;
}

export interface OAuthAccount {
  provider: string;
  provider_user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  has_password: boolean;
  is_active: boolean;
  date_format: string;
  time_format: string;
  thousand_separator: string;
  decimal_separator: string;
  language: string;
  theme: string;
  notification_preferences: NotificationPreferences;
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
      localStorage.removeItem("auth_token"); // legacy key from older versions
    }
    // Purge SW caches + offline IndexedDB so the next user on this browser
    // cannot read this user's data.
    await purgeLocalData();
  },

  getMe: async (options?: { background?: boolean }): Promise<User> => {
    return apiClient.get<User>("/users/me", undefined, options);
  },

  getWorkspaces: async (options?: { background?: boolean }): Promise<Workspace[]> => {
    return apiClient.get<Workspace[]>("/users/me/workspaces", undefined, options);
  },

  updateProfile: async (data: UpdateProfileData): Promise<User> => {
    return apiClient.patch<User>("/users/me", data);
  },

  /**
   * Shared helper for PATCH /users/me/preferences — used by the settings
   * components and theme provider instead of each re-implementing fetch +
   * auth headers. Cookie auth via the /api proxy.
   */
  updatePreferences: async (
    preferences: Record<string, unknown>
  ): Promise<void> => {
    await apiClient.patch("/users/me/preferences", preferences);
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

  setPassword: async (newPassword: string): Promise<void> => {
    await apiClient.patch("/users/me/password", { new_password: newPassword });
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
      localStorage.removeItem("auth_token");
    }
    await purgeLocalData();
  },

  exchangeOAuthCode: async (code: string): Promise<AuthTokenResponse> => {
    const response = await apiClient.post<AuthTokenResponse>("/auth/oauth/exchange", { code });
    apiClient.setToken(response.token);
    return response;
  },

  getConnectedAccounts: async (): Promise<OAuthAccount[]> => {
    const response = await apiClient.get<{ accounts: OAuthAccount[] }>("/auth/oauth/accounts");
    return response.accounts;
  },

  unlinkAccount: async (provider: string): Promise<void> => {
    await apiClient.delete(`/auth/oauth/accounts/${provider}`);
  },
};
