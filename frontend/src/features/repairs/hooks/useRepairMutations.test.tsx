import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { repairHandlers } from "@/test/msw/repairHandlers";
import type { Repair } from "@/lib/types";
import { useRepairMutations } from "./useRepairMutations";

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

function makeRepair(id: string, over: Partial<Repair> = {}): Repair {
  return {
    id,
    workspace_id: "ws-A",
    inventory_id: "inv-1",
    status: "PENDING",
    description: "Replace worn brake pads",
    cost: 4250,
    currency_code: "EUR",
    is_warranty_claim: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...over,
  };
}

// The per-inventory list cache key the drawer query uses.
const LIST_KEY = ["repairs", "ws-A", "by-inventory", "inv-1"];

function makeHarness(seed: Repair[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(LIST_KEY, { items: seed, total: seed.length });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </I18nProvider>
  );
  return { client, wrapper };
}

function cached(client: QueryClient, id: string): Repair | undefined {
  const data = client.getQueryData<{ items: Repair[] }>(LIST_KEY);
  return data?.items.find((r) => r.id === id);
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useRepairMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("startRepair optimistically flips PENDING → IN_PROGRESS, then settles", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([makeRepair("repair-1")]);
    server.use(...repairHandlers);

    const { result } = renderHook(() => useRepairMutations(), { wrapper });
    expect(cached(client, "repair-1")?.status).toBe("PENDING");

    act(() => {
      result.current.startRepair.mutate("repair-1");
    });
    await waitFor(() =>
      expect(cached(client, "repair-1")?.status).toBe("IN_PROGRESS"),
    );
    await waitFor(() =>
      expect(result.current.startRepair.isSuccess).toBe(true),
    );
  });

  it("completeRepair flips IN_PROGRESS → COMPLETED", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([
      makeRepair("repair-1", { status: "IN_PROGRESS" }),
    ]);
    server.use(...repairHandlers);

    const { result } = renderHook(() => useRepairMutations(), { wrapper });
    act(() => {
      result.current.completeRepair.mutate({ id: "repair-1" });
    });
    await waitFor(() =>
      expect(cached(client, "repair-1")?.status).toBe("COMPLETED"),
    );
    await waitFor(() =>
      expect(result.current.completeRepair.isSuccess).toBe(true),
    );
  });

  it("completeRepair WITH new_condition invalidates the ['inventory', wsId] prefix", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([
      makeRepair("repair-1", { status: "IN_PROGRESS" }),
    ]);
    server.use(...repairHandlers);
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useRepairMutations(), { wrapper });
    await act(async () => {
      await result.current.completeRepair.mutateAsync({
        id: "repair-1",
        new_condition: "GOOD",
      });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["inventory", "ws-A"] });
  });

  it("completeRepair WITHOUT new_condition does NOT invalidate inventory", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([
      makeRepair("repair-1", { status: "IN_PROGRESS" }),
    ]);
    server.use(...repairHandlers);
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useRepairMutations(), { wrapper });
    await act(async () => {
      await result.current.completeRepair.mutateAsync({ id: "repair-1" });
    });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ["inventory", "ws-A"] });
  });

  it("createRepair resolves and invalidates ['repairs', wsId]", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([]);
    server.use(...repairHandlers);
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useRepairMutations(), { wrapper });
    await act(async () => {
      await result.current.createRepair.mutateAsync({
        inventory_id: "inv-1",
        description: "New repair",
      });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["repairs", "ws-A"] });
  });

  it("updateRepair optimistically patches the description", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([makeRepair("repair-1")]);
    server.use(...repairHandlers);

    const { result } = renderHook(() => useRepairMutations(), { wrapper });
    act(() => {
      result.current.updateRepair.mutate({
        id: "repair-1",
        body: { description: "Updated description" },
      });
    });
    await waitFor(() =>
      expect(cached(client, "repair-1")?.description).toBe(
        "Updated description",
      ),
    );
    await waitFor(() =>
      expect(result.current.updateRepair.isSuccess).toBe(true),
    );
  });

  it("deleteRepair optimistically removes the row and invalidates the prefix", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([
      makeRepair("repair-1"),
      makeRepair("repair-2"),
    ]);
    server.use(...repairHandlers);
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useRepairMutations(), { wrapper });
    act(() => {
      result.current.deleteRepair.mutate("repair-1");
    });
    await waitFor(() => expect(cached(client, "repair-1")).toBeUndefined());
    await waitFor(() =>
      expect(result.current.deleteRepair.isSuccess).toBe(true),
    );
    expect(cached(client, "repair-2")).toBeDefined();
    expect(spy).toHaveBeenCalledWith({ queryKey: ["repairs", "ws-A"] });
  });

  it("startRepair reverts the optimistic patch and toasts on a 4xx", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([makeRepair("repair-1")]);
    server.use(
      http.post("/api/workspaces/:wsId/repairs/:id/start", () =>
        HttpResponse.json({ message: "bad" }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useRepairMutations(), { wrapper });
    await act(async () => {
      await result.current.startRepair
        .mutateAsync("repair-1")
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.startRepair.isError).toBe(true));
    // Restored to the snapshot — no client-trusted state survives a 4xx.
    expect(cached(client, "repair-1")?.status).toBe("PENDING");
  });
});
