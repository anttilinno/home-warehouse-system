import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

// Mock auth
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    workspaceId: "00000000-0000-0000-0000-000000000001",
    isLoading: false,
    isAuthenticated: true,
    user: { id: "u1" },
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

const listMock = vi.fn();

// Mock categoriesApi so we can inspect params and control the response
vi.mock("@/lib/api/categories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/categories")>();
  return {
    ...actual,
    categoriesApi: {
      ...actual.categoriesApi,
      list: (...args: unknown[]) => listMock(...args),
    },
  };
});

import { useCategoryNameMap } from "../hooks/useCategoryNameMap";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useCategoryNameMap", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("requests categories with archived: true (Pitfall 7)", async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, total_pages: 1 });
    const { result } = renderHook(() => useCategoryNameMap(), { wrapper });
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    const [, params] = listMock.mock.calls[0];
    expect(params.archived).toBe(true);
    expect(result.current.map.size).toBe(0);
  });

  it("builds a Map<id, name> from returned items", async () => {
    listMock.mockResolvedValue({
      items: [
        { id: "cat-1", name: "Power Tools" },
        { id: "cat-2", name: "Hand Tools" },
      ],
      total: 2,
      page: 1,
      total_pages: 1,
    });
    const { result } = renderHook(() => useCategoryNameMap(), { wrapper });
    await waitFor(() => expect(result.current.map.size).toBeGreaterThan(0));
    expect(result.current.map.get("cat-1")).toBe("Power Tools");
    expect(result.current.map.get("cat-2")).toBe("Hand Tools");
  });

  it("surfaces isPending initially", async () => {
    listMock.mockImplementation(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useCategoryNameMap(), { wrapper });
    expect(result.current.isPending).toBe(true);
    expect(result.current.map.size).toBe(0);
  });

  it("surfaces isError on query failure", async () => {
    listMock.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useCategoryNameMap(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
