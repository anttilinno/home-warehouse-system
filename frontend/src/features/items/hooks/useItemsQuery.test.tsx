import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { useItemsQuery, ITEMS_LIMIT } from "./useItemsQuery";

// wsId is sourced from useWorkspace() — mock it so the hook can be exercised
// under a deterministic workspace id.
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

function makeWrapper(initialEntries: string[] = ["/items"]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={initialEntries}>
            {children}
          </MemoryRouter>
        </QueryClientProvider>
      </I18nProvider>
    ),
  };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useItemsQuery", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("keys exactly under the ['items', wsId] prefix (Phase 6 contract)", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeWrapper(["/items?q=drill&page=2"]);
    const { result } = renderHook(() => useItemsQuery(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeTruthy());

    // The query is registered under a key whose first two segments are the
    // exact ['items', wsId] prefix the SSE invalidation map relies on.
    const keys = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey);
    const itemsKey = keys.find((k) => Array.isArray(k) && k[0] === "items");
    expect(itemsKey).toBeDefined();
    expect(itemsKey![0]).toBe("items");
    expect(itemsKey![1]).toBe("ws-A");
  });

  it("reads URL params into the query and sends limit=25", async () => {
    setWsId("ws-A");
    let listUrl: URL | null = null;
    server.use(
      http.get("/api/workspaces/:wsId/items", ({ request }) => {
        listUrl = new URL(request.url);
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 2,
          total_pages: 0,
        });
      }),
    );
    const { wrapper } = makeWrapper(["/items?q=drill&category=cat-1&page=2"]);
    const { result } = renderHook(() => useItemsQuery(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeTruthy());

    expect(listUrl).not.toBeNull();
    expect(listUrl!.searchParams.get("search")).toBe("drill");
    expect(listUrl!.searchParams.get("category_id")).toBe("cat-1");
    expect(listUrl!.searchParams.get("page")).toBe("2");
    expect(listUrl!.searchParams.get("limit")).toBe(String(ITEMS_LIMIT));
    expect(ITEMS_LIMIT).toBe(25);
  });

  it("omits the archived param by default (archived hidden)", async () => {
    setWsId("ws-A");
    let listUrl: URL | null = null;
    server.use(
      http.get("/api/workspaces/:wsId/items", ({ request }) => {
        listUrl = new URL(request.url);
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          total_pages: 0,
        });
      }),
    );
    const { wrapper } = makeWrapper(["/items"]);
    const { result } = renderHook(() => useItemsQuery(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(listUrl!.searchParams.has("archived")).toBe(false);
  });

  it("sends archived=true only when the facet is on", async () => {
    setWsId("ws-A");
    let listUrl: URL | null = null;
    server.use(
      http.get("/api/workspaces/:wsId/items", ({ request }) => {
        listUrl = new URL(request.url);
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          total_pages: 0,
        });
      }),
    );
    const { wrapper } = makeWrapper(["/items?archived=true"]);
    const { result } = renderHook(() => useItemsQuery(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(listUrl!.searchParams.get("archived")).toBe("true");
  });

  it("is disabled without a workspace id", () => {
    setWsId(null);
    const { wrapper } = makeWrapper(["/items"]);
    const { result } = renderHook(() => useItemsQuery(), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
