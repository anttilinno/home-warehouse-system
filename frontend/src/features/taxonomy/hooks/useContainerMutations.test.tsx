import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { containerApi, type Container } from "@/lib/api/container";
import { retroToast } from "@/components/retro";
import { registerMutationDefaults } from "@/lib/offline/mutationDefaults";
import { useContainerMutations } from "./useContainerMutations";

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

describe("useContainerMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("create PREFIX-invalidates ['containers', wsId] (no exact)", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useContainerMutations(), { wrapper });
    await act(async () => {
      await result.current.createContainer({
        name: "Crate",
        location_id: "loc-1",
      });
    });

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["containers", "ws-1"] });
  });

  it("create POSTs a body that carries a client-generated short_code when none supplied", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    let sentBody: unknown;
    server.use(
      http.post("/api/workspaces/:wsId/containers", async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json({
          id: "cont-9",
          workspace_id: "ws-1",
          name: "Crate",
          location_id: "loc-1",
          short_code: "abcdefgh",
          is_archived: false,
          created_at: "2026-06-13T00:00:00Z",
          updated_at: "2026-06-13T00:00:00Z",
        });
      }),
    );

    const { result } = renderHook(() => useContainerMutations(), { wrapper });
    await act(async () => {
      await result.current.createContainer({
        name: "Crate",
        location_id: "loc-1",
      });
    });

    expect(sentBody).toMatchObject({ name: "Crate", location_id: "loc-1" });
    expect((sentBody as { short_code: string }).short_code).toMatch(
      /^[A-Za-z0-9]{8}$/,
    );
  });

  it("create keeps a caller-supplied short_code (scanned QR label) instead of overwriting it", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    let sentBody: unknown;
    server.use(
      http.post("/api/workspaces/:wsId/containers", async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json({
          id: "cont-9",
          workspace_id: "ws-1",
          name: "Crate",
          location_id: "loc-1",
          short_code: "qr123456",
          is_archived: false,
          created_at: "2026-06-13T00:00:00Z",
          updated_at: "2026-06-13T00:00:00Z",
        });
      }),
    );

    const { result } = renderHook(() => useContainerMutations(), { wrapper });
    await act(async () => {
      await result.current.createContainer({
        name: "Crate",
        location_id: "loc-1",
        short_code: "qr123456",
      });
    });

    expect((sentBody as { short_code: string }).short_code).toBe("qr123456");
  });

  it("create's onMutate optimistically inserts a temp row into the ['containers', wsId] cache", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    client.setQueryData<Container[]>(["containers", "ws-1"], []);

    const { result } = renderHook(() => useContainerMutations(), { wrapper });
    act(() => {
      result.current.createContainer({ name: "Crate", location_id: "loc-1" });
    });

    // Optimistic insert is synchronous in onMutate.
    await waitFor(() => {
      const cached = client.getQueryData<Container[]>(["containers", "ws-1"]);
      expect(cached?.some((c) => c.name === "Crate")).toBe(true);
    });
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
  });

  it("update PREFIX-invalidates ['containers', wsId]", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useContainerMutations(), { wrapper });
    await act(async () => {
      await result.current.update.mutateAsync({
        id: "cont-1",
        body: { name: "Toolbox B" },
      });
    });

    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["containers", "ws-1"] });
  });

  it("del invalidates BOTH ['containers', wsId] AND ['inventory', wsId] (FK SET NULL cascade)", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const apiSpy = vi.spyOn(containerApi, "del");
    const invSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useContainerMutations(), { wrapper });
    await act(async () => {
      await result.current.del.mutateAsync({ id: "cont-1", name: "Toolbox A" });
    });

    await waitFor(() => expect(result.current.del.isSuccess).toBe(true));
    expect(apiSpy).toHaveBeenCalledWith("ws-1", "cont-1");
    // Double PREFIX-invalidate (T-10-05 / OQ2).
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ["containers", "ws-1"] });
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ["inventory", "ws-1"] });
  });

  it("del maps a 409 to a conflict toast", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    const toastSpy = vi.spyOn(retroToast, "error");
    server.use(
      http.delete("/api/workspaces/:wsId/containers/:id", () =>
        HttpResponse.json({ message: "in use" }, { status: 409 }),
      ),
    );

    const { result } = renderHook(() => useContainerMutations(), { wrapper });
    await act(async () => {
      await result.current.del
        .mutateAsync({ id: "cont-1", name: "Toolbox A" })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.del.isError).toBe(true));
    expect(toastSpy).toHaveBeenCalledWith(
      expect.stringMatching(/still in use|can't be deleted/i),
    );
  });
});
