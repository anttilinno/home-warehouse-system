import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { useMarkReviewedItem } from "./useMarkReviewedItem";

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [],
    isLoading: false,
  });
}

function makeHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      I18nProvider,
      { i18n },
      createElement(QueryClientProvider, { client }, children),
    );
  return { client, wrapper };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useMarkReviewedItem", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("PATCHes the item with { needs_review: false }", async () => {
    setWsId("ws-A");
    let captured: unknown = null;
    server.use(
      http.patch(
        "*/workspaces/ws-A/items/it-1",
        async ({ request }) => {
          captured = await request.json();
          return HttpResponse.json({ id: "it-1", name: "Drill", sku: "S1" });
        },
      ),
    );
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => useMarkReviewedItem(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("it-1");
    });
    expect(captured).toEqual({ needs_review: false });
  });

  it("invalidates the items prefix AND the by-barcode family on success", async () => {
    setWsId("ws-A");
    server.use(
      http.patch("*/workspaces/ws-A/items/it-1", () =>
        HttpResponse.json({ id: "it-1", name: "Drill", sku: "S1" }),
      ),
    );
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useMarkReviewedItem(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("it-1");
    });
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: ["items", "ws-A"] });
      expect(spy).toHaveBeenCalledWith({
        queryKey: ["item-by-barcode", "ws-A"],
      });
    });
  });
});
