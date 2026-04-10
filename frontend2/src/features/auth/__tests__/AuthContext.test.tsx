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

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("on mount, calls GET /users/me and sets authenticated on success", async () => {
    mockGet.mockResolvedValueOnce(fakeUser);

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

    // Login
    mockPost.mockResolvedValueOnce({ token: "t", refresh_token: "rt" });
    mockGet.mockResolvedValueOnce(fakeUser);

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

    // Register
    mockPost.mockResolvedValueOnce({ token: "t", refresh_token: "rt" });
    mockGet.mockResolvedValueOnce(fakeUser);

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

    // Resolve the session check
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
});
