"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authApi, type User, type Workspace, type RegisterData } from "@/lib/api/auth";
import { ensureOfflineDBOwner } from "@/lib/db/offline-db";

interface AuthContextValue {
  user: User | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  workspaceId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => void;
  refreshUser: () => Promise<void>;
  loadUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const loadUserData = useCallback(async () => {
    try {
      // Probe /users/me to discover whether a session cookie exists.
      // (Token no longer lives in localStorage, so this is the auth check.)
      // Fetch user data and workspaces in parallel. `background` keeps the
      // apiClient from hard-redirecting on 401 — the catch below decides.
      const [userData, workspacesData] = await Promise.all([
        authApi.getMe({ background: true }),
        authApi.getWorkspaces({ background: true }),
      ]);

      setUser(userData);
      setWorkspaces(workspacesData);

      // Load workspace_id from localStorage
      let selectedWorkspaceId: string | null = null;
      if (typeof window !== "undefined") {
        const storedWorkspaceId = localStorage.getItem("workspace_id");

        // Check if stored workspace belongs to current user
        const storedWorkspaceValid = storedWorkspaceId &&
          workspacesData.some((w) => w.id === storedWorkspaceId);

        // If no valid workspace selected but user has workspaces, auto-select first
        if (!storedWorkspaceValid && workspacesData.length > 0) {
          const firstWorkspaceId = workspacesData[0].id;
          localStorage.setItem("workspace_id", firstWorkspaceId);
          setWorkspaceId(firstWorkspaceId);
          selectedWorkspaceId = firstWorkspaceId;
        } else if (storedWorkspaceValid) {
          setWorkspaceId(storedWorkspaceId);
          selectedWorkspaceId = storedWorkspaceId;
        }
      }

      // Scope the offline IndexedDB to this user: wipes the DB if a
      // different user was logged in on this browser before.
      await ensureOfflineDBOwner(userData.id, selectedWorkspaceId);
    } catch (error) {
      // If we get 401 or any auth error, clear state and redirect to login
      console.error("Failed to load user data:", error);
      localStorage.removeItem("workspace_id");
      setUser(null);
      setWorkspaces([]);
      setWorkspaceId(null);
      // Redirect to login (apiClient may have already done this for 401)
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        router.push("/login");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await authApi.login(email, password);
      // Load user data after successful login
      await loadUserData();
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  }, [loadUserData]);

  const register = useCallback(async (data: RegisterData) => {
    setIsLoading(true);
    try {
      await authApi.register(data);
      // Load user data after successful registration
      await loadUserData();
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  }, [loadUserData]);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setWorkspaces([]);
    setWorkspaceId(null);

    // Redirect to login
    if (typeof window !== "undefined") {
      router.push("/login");
    }
  }, [router]);

  const switchWorkspace = useCallback((newWorkspaceId: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("workspace_id", newWorkspaceId);
      setWorkspaceId(newWorkspaceId);
      // Reload the page to refresh all data with new workspace context
      window.location.reload();
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch (error) {
      console.error("Failed to refresh user data:", error);
      // If refresh fails with auth error, logout
      logout();
    }
  }, [logout]);

  const currentWorkspace = workspaces.find((ws) => ws.id === workspaceId) || null;
  const isAuthenticated = !!user && !!workspaceId;

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      workspaces,
      currentWorkspace,
      workspaceId,
      isLoading,
      isAuthenticated,
      login,
      register,
      logout,
      switchWorkspace,
      refreshUser,
      loadUserData,
    }),
    [
      user,
      workspaces,
      currentWorkspace,
      workspaceId,
      isLoading,
      isAuthenticated,
      login,
      register,
      logout,
      switchWorkspace,
      refreshUser,
      loadUserData,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
