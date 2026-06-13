import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { server } from "@/test/msw/server";
import {
  INVENTORY_LIMIT,
  readInventoryUrlState,
  toListParams,
  useInventoryQuery,
} from "./useInventoryQuery";

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

function makeWrapper(initialEntries: string[] = ["/inventory"]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return wrapper;
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useInventoryQuery URL state", () => {
  it("defaults page to 1 and limit to 25", () => {
    const state = readInventoryUrlState(new URLSearchParams());
    expect(state.page).toBe(1);
    expect(toListParams(state)).toEqual({ page: 1, limit: INVENTORY_LIMIT });
    expect(INVENTORY_LIMIT).toBe(25);
  });

  it("reads ?page from the URL (clamped to >= 1)", () => {
    expect(readInventoryUrlState(new URLSearchParams("page=3")).page).toBe(3);
    expect(readInventoryUrlState(new URLSearchParams("page=0")).page).toBe(1);
    expect(readInventoryUrlState(new URLSearchParams("page=-2")).page).toBe(1);
  });
});

describe("useInventoryQuery", () => {
  beforeAll(() => {});

  it("is disabled until a workspace is selected", () => {
    setWsId(null);
    const { result } = renderHook(() => useInventoryQuery(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("fetches the full envelope keyed by wsId + params", async () => {
    setWsId("ws-A");
    server.use(
      http.get("/api/workspaces/:wsId/inventory", () =>
        HttpResponse.json({
          items: [{ id: "inv-1" }],
          total: 1,
          page: 1,
          total_pages: 1,
        }),
      ),
    );
    const { result } = renderHook(() => useInventoryQuery(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.total).toBe(1);
  });

  it("requests the page from ?page", async () => {
    setWsId("ws-A");
    let requestedPage: string | null = null;
    server.use(
      http.get("/api/workspaces/:wsId/inventory", ({ request }) => {
        requestedPage = new URL(request.url).searchParams.get("page");
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 2,
          total_pages: 3,
        });
      }),
    );
    const { result } = renderHook(() => useInventoryQuery(), {
      wrapper: makeWrapper(["/inventory?page=2"]),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedPage).toBe("2");
    expect(result.current.state.page).toBe(2);
  });
});
