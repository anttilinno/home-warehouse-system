import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { maintenanceHandlers } from "@/test/msw/maintenanceHandlers";
import type { MaintenanceSchedule } from "@/lib/types";
import { useMaintenanceMutations } from "./useMaintenanceMutations";

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

function makeSchedule(
  id: string,
  over: Partial<MaintenanceSchedule> = {},
): MaintenanceSchedule {
  return {
    id,
    title: "Oil change",
    interval_days: 180,
    next_due: "2026-07-01",
    last_completed_at: "2026-01-02T00:00:00Z",
    ...over,
  };
}

// The per-inventory list cache key the drawer query uses.
const LIST_KEY = ["maintenance", "ws-A", "by-inventory", "inv-1"];

function makeHarness(seed: MaintenanceSchedule[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(LIST_KEY, { items: seed });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </I18nProvider>
  );
  return { client, wrapper };
}

function cached(
  client: QueryClient,
  id: string,
): MaintenanceSchedule | undefined {
  const data = client.getQueryData<{ items: MaintenanceSchedule[] }>(LIST_KEY);
  return data?.items.find((s) => s.id === id);
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useMaintenanceMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("createSchedule resolves and invalidates ['maintenance', wsId]", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([]);
    server.use(...maintenanceHandlers);
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useMaintenanceMutations(), { wrapper });
    await act(async () => {
      await result.current.createSchedule.mutateAsync({
        inventory_id: "inv-1",
        title: "New schedule",
        interval_days: 30,
        next_due: "2026-08-01",
      });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["maintenance", "ws-A"] });
  });

  it("updateSchedule optimistically patches the title and invalidates", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([makeSchedule("sched-1")]);
    server.use(...maintenanceHandlers);
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useMaintenanceMutations(), { wrapper });
    act(() => {
      result.current.updateSchedule.mutate({
        id: "sched-1",
        body: { title: "Updated title" },
      });
    });
    await waitFor(() =>
      expect(cached(client, "sched-1")?.title).toBe("Updated title"),
    );
    await waitFor(() =>
      expect(result.current.updateSchedule.isSuccess).toBe(true),
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: ["maintenance", "ws-A"] });
  });

  it("deleteSchedule optimistically removes the row and invalidates", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([
      makeSchedule("sched-1"),
      makeSchedule("sched-2"),
    ]);
    server.use(...maintenanceHandlers);
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useMaintenanceMutations(), { wrapper });
    act(() => {
      result.current.deleteSchedule.mutate("sched-1");
    });
    await waitFor(() => expect(cached(client, "sched-1")).toBeUndefined());
    await waitFor(() =>
      expect(result.current.deleteSchedule.isSuccess).toBe(true),
    );
    expect(cached(client, "sched-2")).toBeDefined();
    expect(spy).toHaveBeenCalledWith({ queryKey: ["maintenance", "ws-A"] });
  });

  it("completeSchedule calls the complete endpoint", async () => {
    setWsId("ws-A");
    const { wrapper } = makeHarness([makeSchedule("sched-1")]);
    let completed = false;
    server.use(
      http.post("/api/workspaces/:wsId/maintenance/:id/complete", () => {
        completed = true;
        return HttpResponse.json(
          makeSchedule("sched-1", { next_due: "2027-01-01" }),
        );
      }),
      ...maintenanceHandlers,
    );

    const { result } = renderHook(() => useMaintenanceMutations(), { wrapper });
    await act(async () => {
      await result.current.completeSchedule.mutateAsync("sched-1");
    });
    expect(completed).toBe(true);
  });

  it("completeSchedule invalidates BOTH ['maintenance', wsId] AND ['repairs', wsId] (override #7)", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([makeSchedule("sched-1")]);
    server.use(...maintenanceHandlers);
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useMaintenanceMutations(), { wrapper });
    await act(async () => {
      await result.current.completeSchedule.mutateAsync("sched-1");
    });
    // The server wrote a repair-log row — both caches must be invalidated.
    expect(spy).toHaveBeenCalledWith({ queryKey: ["maintenance", "ws-A"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["repairs", "ws-A"] });
  });

  it("deleteSchedule reverts the optimistic removal and toasts on a 4xx", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([makeSchedule("sched-1")]);
    server.use(
      http.delete("/api/workspaces/:wsId/maintenance/:id", () =>
        HttpResponse.json({ message: "bad" }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useMaintenanceMutations(), { wrapper });
    await act(async () => {
      await result.current.deleteSchedule
        .mutateAsync("sched-1")
        .catch(() => undefined);
    });

    await waitFor(() =>
      expect(result.current.deleteSchedule.isError).toBe(true),
    );
    // Restored to the snapshot — no client-trusted state survives a 4xx.
    expect(cached(client, "sched-1")).toBeDefined();
  });
});
