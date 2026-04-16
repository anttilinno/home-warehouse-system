import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import React from "react";

i18n.load("en", {});
i18n.activate("en");

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

const { addToast, itemsApiMock } = vi.hoisted(() => ({
  addToast: vi.fn(),
  itemsApiMock: {
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/components/retro", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/retro")>();
  return { ...actual, useToast: () => ({ addToast }) };
});

vi.mock("@/lib/api/items", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/items")>();
  return {
    ...actual,
    itemsApi: { ...actual.itemsApi, ...itemsApiMock },
  };
});

import {
  useCreateItem,
  useUpdateItem,
  useArchiveItem,
  useRestoreItem,
  useDeleteItem,
} from "../hooks/useItemMutations";
import { HttpError } from "@/lib/api";
import { makeItem } from "./fixtures";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const removeSpy = vi.spyOn(qc, "removeQueries");
  const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
  const Wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(
      I18nProvider,
      { i18n },
      React.createElement(QueryClientProvider, { client: qc }, children),
    );
  return { Wrapper, removeSpy, invalidateSpy };
}

beforeEach(() => {
  addToast.mockReset();
  Object.values(itemsApiMock).forEach((fn) => fn.mockReset());
});

describe("useCreateItem", () => {
  it("invalidates itemKeys.all and toasts on success", async () => {
    const { Wrapper, invalidateSpy } = makeWrapper();
    itemsApiMock.create.mockResolvedValue(makeItem());
    const { result } = renderHook(() => useCreateItem(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: "X", sku: "ITEM-TEST-0001" });
    });
    expect(invalidateSpy).toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining("created"), "success");
  });

  it("maps 400 SKU collision to specific toast (Pitfall 6)", async () => {
    const { Wrapper } = makeWrapper();
    itemsApiMock.create.mockRejectedValue(
      new HttpError(400, "SKU already exists in workspace"),
    );
    const { result } = renderHook(() => useCreateItem(), { wrapper: Wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({ name: "X", sku: "DUP" });
      } catch {
        /* expected */
      }
    });
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining("SKU"), "error");
  });

  it("maps non-SKU 400 to generic toast", async () => {
    const { Wrapper } = makeWrapper();
    itemsApiMock.create.mockRejectedValue(new HttpError(400, "name too long"));
    const { result } = renderHook(() => useCreateItem(), { wrapper: Wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({ name: "X", sku: "Y" });
      } catch {
        /* expected */
      }
    });
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining("save"), "error");
  });
});

describe("useUpdateItem", () => {
  it("maps 400 SKU collision to specific toast", async () => {
    const { Wrapper } = makeWrapper();
    itemsApiMock.update.mockRejectedValue(
      new HttpError(400, "SKU already exists in workspace"),
    );
    const { result } = renderHook(() => useUpdateItem(), { wrapper: Wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({ id: "i1", input: { sku: "DUP" } });
      } catch {
        /* expected */
      }
    });
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining("SKU"), "error");
  });

  it("toasts saved on success", async () => {
    const { Wrapper } = makeWrapper();
    itemsApiMock.update.mockResolvedValue(makeItem());
    const { result } = renderHook(() => useUpdateItem(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "i1", input: { name: "Updated" } });
    });
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining("saved"), "success");
  });
});

describe("useDeleteItem", () => {
  it("removes detail query BEFORE invalidating list (Pitfall 9)", async () => {
    const { Wrapper, removeSpy, invalidateSpy } = makeWrapper();
    itemsApiMock.delete.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteItem(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync("item-id");
    });
    expect(removeSpy).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
    const removeCallOrder = removeSpy.mock.invocationCallOrder[0];
    const invalidateCallOrder = invalidateSpy.mock.invocationCallOrder[0];
    expect(removeCallOrder).toBeLessThan(invalidateCallOrder);
  });

  it("calls onAfterDelete callback on success", async () => {
    const { Wrapper } = makeWrapper();
    itemsApiMock.delete.mockResolvedValue(undefined);
    const onAfterDelete = vi.fn();
    const { result } = renderHook(() => useDeleteItem({ onAfterDelete }), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync("item-id");
    });
    expect(onAfterDelete).toHaveBeenCalledOnce();
  });

  it("generic error toast on failure (no active-loans branch)", async () => {
    const { Wrapper } = makeWrapper();
    itemsApiMock.delete.mockRejectedValue(new HttpError(400, "active loans"));
    const { result } = renderHook(() => useDeleteItem(), { wrapper: Wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync("item-id");
      } catch {
        /* expected */
      }
    });
    // Items have NO active-loans branch — all 400s map to generic
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining("delete"), "error");
    expect(addToast).not.toHaveBeenCalledWith(
      expect.stringContaining("active loan"),
      "error",
    );
  });
});

describe("useArchiveItem / useRestoreItem", () => {
  it("archive success toast", async () => {
    const { Wrapper } = makeWrapper();
    itemsApiMock.archive.mockResolvedValue(undefined);
    const { result } = renderHook(() => useArchiveItem(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync("item-id");
    });
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining("archived"), "success");
  });

  it("restore success toast", async () => {
    const { Wrapper } = makeWrapper();
    itemsApiMock.restore.mockResolvedValue(undefined);
    const { result } = renderHook(() => useRestoreItem(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync("item-id");
    });
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining("restored"), "success");
  });
});
