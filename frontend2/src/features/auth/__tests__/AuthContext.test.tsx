import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";
import type { ReactNode } from "react";

// Mock @/lib/api
vi.mock("@/lib/api", () => ({
  get: vi.fn(),
  post: vi.fn(),
  setRefreshToken: vi.fn(),
}));

import { get, post, setRefreshToken } from "@/lib/api";

const mockGet = vi.mocked(get);
const mockPost = vi.mocked(post);
const mockSetRefreshToken = vi.mocked(setRefreshToken);

const fakeUser = {
  id: "u1",
  email: "test@example.com",
  full_name: "Test User",
  has_password: true,
  is_active: true,
  date_format: "YYYY-MM-DD",
  time_format: "HH:mm",
  thousand_separator: ",",
  decimal_separator: ".",
  language: "en",
  theme: "retro",
  avatar_url: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const fakeWorkspace = {
  id: "ws-1",
  name: "Personal",
  slug: "personal",
  is_personal: true,
  role: "owner",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const fakeNonPersonalWorkspace = {
  id: "ws-2",
  name: "Shared",
  slug: "shared",
  is_personal: false,
  role: "member",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("on mount, calls GET /users/me and sets authenticated on success", async () => {
    mockGet.mockResolvedValueOnce(fakeUser);
    mockGet.mockResolvedValueOnce({ items: [fakeWorkspace] });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith("/users/me");
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(fakeUser);
  });

  it("on mount, handles /users/me failure gracefully (unauthenticated)", async () => {
    mockGet.mockRejectedValueOnce(new Error("Unauthorized"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(mockSetRefreshToken).toHaveBeenCalledWith(null);
  });

  it("login() calls POST /auth/login then GET /users/me", async () => {
    // Mount: /users/me fails
    mockGet.mockRejectedValueOnce(new Error("Unauthorized"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Login: loadUser calls /users/me then /workspaces
    mockPost.mockResolvedValueOnce({ token: "t", refresh_token: "rt" });
    mockGet.mockResolvedValueOnce(fakeUser);
    mockGet.mockResolvedValueOnce({ items: [fakeWorkspace] });

    await act(async () => {
      await result.current.login("test@example.com", "password");
    });

    expect(mockPost).toHaveBeenCalledWith("/auth/login", {
      email: "test@example.com",
      password: "password",
    });
    expect(mockSetRefreshToken).toHaveBeenCalledWith("rt");
    expect(mockGet).toHaveBeenCalledWith("/users/me");
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(fakeUser);
  });

  it("register() calls POST /auth/register then GET /users/me", async () => {
    // Mount: /users/me fails
    mockGet.mockRejectedValueOnce(new Error("Unauthorized"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Register: loadUser calls /users/me then /workspaces
    mockPost.mockResolvedValueOnce({ token: "t", refresh_token: "rt" });
    mockGet.mockResolvedValueOnce(fakeUser);
    mockGet.mockResolvedValueOnce({ items: [fakeWorkspace] });

    await act(async () => {
      await result.current.register({
        email: "test@example.com",
        password: "password",
        full_name: "Test User",
      });
    });

    expect(mockPost).toHaveBeenCalledWith("/auth/register", {
      email: "test@example.com",
      password: "password",
      full_name: "Test User",
    });
    expect(mockSetRefreshToken).toHaveBeenCalledWith("rt");
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("logout() calls POST /auth/logout and clears user", async () => {
    // Mount: authenticated
    mockGet.mockResolvedValueOnce(fakeUser);
    mockGet.mockResolvedValueOnce({ items: [fakeWorkspace] });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    expect(mockPost).toHaveBeenCalledWith("/auth/logout");
    expect(mockSetRefreshToken).toHaveBeenCalledWith(null);
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("isLoading is true during initial session check, then false", async () => {
    let resolveGet: (value: unknown) => void;
    mockGet.mockImplementationOnce(
      () => new Promise((resolve) => { resolveGet = resolve; })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Resolve the session check -- also need /workspaces mock
    mockGet.mockResolvedValueOnce({ items: [fakeWorkspace] });

    await act(async () => {
      resolveGet!(fakeUser);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("useAuth() outside AuthProvider throws error", () => {
    // Suppress console.error for expected error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within AuthProvider");

    spy.mockRestore();
  });

  // --- New workspace tests ---

  it("after mount with personal workspace, workspaceId equals the personal workspace id", async () => {
    mockGet.mockResolvedValueOnce(fakeUser);
    mockGet.mockResolvedValueOnce({ items: [fakeNonPersonalWorkspace, fakeWorkspace] });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.workspaceId).toBe("ws-1");
  });

  it("after mount with no personal workspace, workspaceId falls back to first workspace", async () => {
    mockGet.mockResolvedValueOnce(fakeUser);
    mockGet.mockResolvedValueOnce({ items: [fakeNonPersonalWorkspace] });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.workspaceId).toBe("ws-2");
  });

  it("after mount with empty workspaces, workspaceId is null", async () => {
    mockGet.mockResolvedValueOnce(fakeUser);
    mockGet.mockResolvedValueOnce({ items: [] });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.workspaceId).toBeNull();
  });

  it("after login, workspaceId is set from /workspaces", async () => {
    // Mount: /users/me fails
    mockGet.mockRejectedValueOnce(new Error("Unauthorized"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.workspaceId).toBeNull();

    // Login
    mockPost.mockResolvedValueOnce({ token: "t", refresh_token: "rt" });
    mockGet.mockResolvedValueOnce(fakeUser);
    mockGet.mockResolvedValueOnce({ items: [fakeWorkspace] });

    await act(async () => {
      await result.current.login("test@example.com", "password");
    });

    expect(result.current.workspaceId).toBe("ws-1");
  });

  it("after logout, workspaceId is null", async () => {
    // Mount: authenticated with workspace
    mockGet.mockResolvedValueOnce(fakeUser);
    mockGet.mockResolvedValueOnce({ items: [fakeWorkspace] });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    expect(result.current.workspaceId).toBe("ws-1");

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.workspaceId).toBeNull();
  });

  it("if /users/me fails on mount, workspaceId stays null (no /workspaces call)", async () => {
    mockGet.mockRejectedValueOnce(new Error("Unauthorized"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.workspaceId).toBeNull();
    // Only 1 call made (/users/me), not 2
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith("/users/me");
  });
});
