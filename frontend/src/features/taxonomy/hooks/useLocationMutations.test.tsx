import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { locationApi, type Location } from "@/lib/api/location";
import { registerMutationDefaults } from "@/lib/offline/mutationDefaults";
import { useLocationMutations } from "./useLocationMutations";

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
  // create's mutationFn now lives in the centrally-registered default
  // (mutationDefaults.ts) rather than inline — register it on this harness's
  // own client, mirroring the boot-time call in App.tsx.
  registerMutationDefaults(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </I18nProvider>
  );
  return { client, wrapper };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useLocationMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("create PREFIX-invalidates ['locations', wsId] (no exact)", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    await act(async () => {
      await result.current.createLocation({ name: "Basement" });
    });

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["locations", "ws-1"] });
  });

  it("create POSTs a body that carries a client-generated short_code when none supplied", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    let sentBody: unknown;
    server.use(
      http.post("/api/workspaces/:wsId/locations", async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json({
          id: "loc-9",
          workspace_id: "ws-1",
          name: "Basement",
          short_code: "abcdefgh",
          is_archived: false,
          created_at: "2026-06-13T00:00:00Z",
          updated_at: "2026-06-13T00:00:00Z",
        });
      }),
    );

    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    await act(async () => {
      await result.current.createLocation({ name: "Basement" });
    });

    expect(sentBody).toMatchObject({ name: "Basement" });
    expect((sentBody as { short_code: string }).short_code).toMatch(
      /^[A-Za-z0-9]{8}$/,
    );
  });

  it("create keeps a caller-supplied short_code (scanned QR label) instead of overwriting it", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    let sentBody: unknown;
    server.use(
      http.post("/api/workspaces/:wsId/locations", async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json({
          id: "loc-9",
          workspace_id: "ws-1",
          name: "Basement",
          short_code: "qr123456",
          is_archived: false,
          created_at: "2026-06-13T00:00:00Z",
          updated_at: "2026-06-13T00:00:00Z",
        });
      }),
    );

    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    await act(async () => {
      await result.current.createLocation({
        name: "Basement",
        short_code: "qr123456",
      });
    });

    expect((sentBody as { short_code: string }).short_code).toBe("qr123456");
  });

  it("create's onMutate optimistically inserts a temp row into the ['locations', wsId] cache", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    client.setQueryData<Location[]>(["locations", "ws-1"], []);

    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    act(() => {
      result.current.createLocation({ name: "Basement" });
    });

    // Optimistic insert is synchronous in onMutate.
    await waitFor(() => {
      const cached = client.getQueryData<Location[]>(["locations", "ws-1"]);
      expect(cached?.some((l) => l.name === "Basement")).toBe(true);
    });
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
  });

  it("update PREFIX-invalidates ['locations', wsId]", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    await act(async () => {
      await result.current.update.mutateAsync({
        id: "loc-1",
        body: { name: "Workshop" },
      });
    });

    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["locations", "ws-1"] });
  });

  it("archive calls locationApi.archive and invalidates the prefix", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const apiSpy = vi.spyOn(locationApi, "archive");
    const invSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    await act(async () => {
      await result.current.archive.mutateAsync({ id: "loc-1", name: "Garage" });
    });

    expect(apiSpy).toHaveBeenCalledWith("ws-1", "loc-1");
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ["locations", "ws-1"] });
  });

  it("restore calls locationApi.restore", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    const apiSpy = vi.spyOn(locationApi, "restore");

    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    await act(async () => {
      await result.current.restore.mutateAsync({ id: "loc-1", name: "Garage" });
    });

    expect(apiSpy).toHaveBeenCalledWith("ws-1", "loc-1");
  });

  it("does NOT expose a del mutation (TAX-04 archive-only)", () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    // Locations are archive-only — del must be absent (location hard-delete is
    // dangerous: CASCADE/RESTRICT). T-10-07 mitigation.
    expect((result.current as Record<string, unknown>).del).toBeUndefined();
  });

  it("create error path surfaces isError (failure toast fires)", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    server.use(
      http.post("/api/workspaces/:wsId/locations", () =>
        HttpResponse.json({ message: "bad" }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    await act(async () => {
      await result.current.createLocation({ name: "x" }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.create.isError).toBe(true));
  });
});
