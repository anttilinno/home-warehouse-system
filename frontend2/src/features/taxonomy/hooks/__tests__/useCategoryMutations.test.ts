import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import React from "react";

// Mock the categories API module
vi.mock("@/lib/api/categories", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/categories")>();
  return {
    ...actual,
    categoriesApi: {
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
      remove: vi.fn(),
      list: vi.fn(),
      listRoot: vi.fn(),
      listChildren: vi.fn(),
      breadcrumb: vi.fn(),
      get: vi.fn(),
    },
  };
});

// Capture toast calls via a spy exposed through the mocked retro barrel
const addToastSpy = vi.fn();
vi.mock("@/components/retro", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/retro")>();
  return {
    ...actual,
    useToast: () => ({ addToast: addToastSpy }),
  };
});

// Mock AuthContext to supply a workspaceId
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    workspaceId: "ws-1",
    isLoading: false,
    isAuthenticated: true,
    user: { id: "u1" },
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

import { categoriesApi } from "@/lib/api/categories";
import { HttpError } from "@/lib/api";
import {
  useCreateCategory,
  useDeleteCategory,
  useArchiveCategory,
} from "../useCategoryMutations";

i18n.load("en", {});
i18n.activate("en");

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      I18nProvider,
      { i18n },
      React.createElement(QueryClientProvider, { client: qc }, children),
    );
  };
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const mockedApi = vi.mocked(categoriesApi);

beforeEach(() => {
  addToastSpy.mockClear();
  vi.clearAllMocks();
});

describe("useCategoryMutations", () => {
  it("invalidates categoryKeys.all and shows success toast on create success", async () => {
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const fakeCategory = {
      id: "c1",
      workspace_id: "ws-1",
      name: "Tools",
      is_archived: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    mockedApi.create.mockResolvedValueOnce(fakeCategory);

    const { result } = renderHook(() => useCreateCategory(), {
      wrapper: makeWrapper(qc),
    });

    await result.current.mutateAsync({ name: "Tools" });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["categories"],
      });
    });
    expect(addToastSpy).toHaveBeenCalledWith("Category created.", "success");
  });

  it("surfaces 'Move or delete child nodes first.' on HttpError 409 delete", async () => {
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    mockedApi.remove.mockRejectedValueOnce(new HttpError(409, "conflict"));

    const { result } = renderHook(() => useDeleteCategory(), {
      wrapper: makeWrapper(qc),
    });

    await expect(result.current.mutateAsync("some-id")).rejects.toBeDefined();

    await waitFor(() => {
      expect(addToastSpy).toHaveBeenCalledWith(
        "Move or delete child nodes first.",
        "error",
      );
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("shows generic toast on non-409 delete failure", async () => {
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    mockedApi.remove.mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useDeleteCategory(), {
      wrapper: makeWrapper(qc),
    });

    await expect(result.current.mutateAsync("some-id")).rejects.toBeDefined();

    await waitFor(() => {
      expect(addToastSpy).toHaveBeenCalledWith(
        "Connection lost. Your change was not saved.",
        "error",
      );
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("invalidates on archive success", async () => {
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    mockedApi.archive.mockResolvedValueOnce(undefined as unknown as void);

    const { result } = renderHook(() => useArchiveCategory(), {
      wrapper: makeWrapper(qc),
    });

    await result.current.mutateAsync("some-id");

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["categories"],
      });
    });
    expect(addToastSpy).toHaveBeenCalledWith("Category archived.", "success");
  });
});
