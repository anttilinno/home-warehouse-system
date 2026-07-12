import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { retroToast } from "@/components/retro";
import { usePhotoMutations } from "./usePhotoMutations";

// Phase 4 Plan Test-Gaps 4.3 — usePhotoMutations is scoped by explicit
// (wsId, itemId) args, not useWorkspace, so no workspace mock is needed. Every
// mutation invalidates the ["items", wsId] PREFIX per the hook's block comment;
// setPrimary/updateCaption/del/bulkDelete/bulkCaption/reorder each fire a
// distinct danger toast on error (mirrors useNotificationMutations.test.tsx's
// error-path assertion).

vi.mock("@/components/retro", async (orig) => {
  const mod = await orig<typeof import("@/components/retro")>();
  return { ...mod, retroToast: { ...mod.retroToast, error: vi.fn() } };
});

function makeHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </I18nProvider>
  );
  return { client, wrapper };
}

const PHOTO = {
  id: "photo-1",
  item_id: "it-1",
  url: "http://localhost:8080/files/photo-1.jpg",
  thumbnail_url: "http://localhost:8080/files/photo-1-thumb.jpg",
  is_primary: false,
  caption: "",
  sort_order: 0,
  created_at: "2026-06-13T00:00:00Z",
};

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("usePhotoMutations", () => {
  it("upload POSTs multipart and invalidates the ['items', wsId] prefix", async () => {
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");
    server.use(
      http.post("/api/workspaces/:wsId/items/:itemId/photos", () =>
        HttpResponse.json(PHOTO),
      ),
    );

    const { result } = renderHook(() => usePhotoMutations("ws-A", "it-1"), {
      wrapper,
    });
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    await act(async () => {
      await result.current.upload.mutateAsync({ file });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ["items", "ws-A"] });
  });

  it("setPrimary PUTs /photos/:id/primary, invalidates the prefix, no toast on success", async () => {
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");
    server.use(
      http.put(
        "/api/workspaces/:wsId/photos/:photoId/primary",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { result } = renderHook(() => usePhotoMutations("ws-A", "it-1"), {
      wrapper,
    });
    await act(async () => {
      await result.current.setPrimary.mutateAsync("photo-1");
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ["items", "ws-A"] });
    expect(retroToast.error).not.toHaveBeenCalled();
  });

  it("setPrimary surfaces a danger toast on error", async () => {
    const { wrapper } = makeHarness();
    server.use(
      http.put("/api/workspaces/:wsId/photos/:photoId/primary", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => usePhotoMutations("ws-A", "it-1"), {
      wrapper,
    });
    await act(async () => {
      await result.current.setPrimary
        .mutateAsync("photo-1")
        .catch(() => undefined);
    });

    expect(result.current.setPrimary.isError).toBe(true);
    expect(retroToast.error).toHaveBeenCalledTimes(1);
  });

  it("updateCaption PUTs the caption body and surfaces a toast on error", async () => {
    const { wrapper } = makeHarness();
    server.use(
      http.put("/api/workspaces/:wsId/photos/:photoId/caption", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => usePhotoMutations("ws-A", "it-1"), {
      wrapper,
    });
    await act(async () => {
      await result.current.updateCaption
        .mutateAsync({ photoId: "photo-1", caption: "New" })
        .catch(() => undefined);
    });

    expect(result.current.updateCaption.isError).toBe(true);
    expect(retroToast.error).toHaveBeenCalledTimes(1);
  });

  it("del DELETEs the photo and invalidates the prefix", async () => {
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");
    server.use(
      http.delete(
        "/api/workspaces/:wsId/photos/:photoId",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { result } = renderHook(() => usePhotoMutations("ws-A", "it-1"), {
      wrapper,
    });
    await act(async () => {
      await result.current.del.mutateAsync("photo-1");
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ["items", "ws-A"] });
  });

  it("bulkDelete POSTs the full id list and surfaces a toast on error", async () => {
    const { wrapper } = makeHarness();
    let sentBody: unknown;
    server.use(
      http.post(
        "/api/workspaces/:wsId/items/:itemId/photos/bulk-delete",
        async ({ request }) => {
          sentBody = await request.json();
          return HttpResponse.json({ message: "boom" }, { status: 500 });
        },
      ),
    );

    const { result } = renderHook(() => usePhotoMutations("ws-A", "it-1"), {
      wrapper,
    });
    await act(async () => {
      await result.current.bulkDelete
        .mutateAsync(["photo-1", "photo-2"])
        .catch(() => undefined);
    });

    expect(sentBody).toEqual({ photo_ids: ["photo-1", "photo-2"] });
    expect(retroToast.error).toHaveBeenCalledTimes(1);
  });

  it("bulkCaption POSTs the updates array and invalidates the prefix", async () => {
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");
    let sentBody: unknown;
    server.use(
      http.post(
        "/api/workspaces/:wsId/items/:itemId/photos/bulk-caption",
        async ({ request }) => {
          sentBody = await request.json();
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    const { result } = renderHook(() => usePhotoMutations("ws-A", "it-1"), {
      wrapper,
    });
    await act(async () => {
      await result.current.bulkCaption.mutateAsync([
        { photo_id: "photo-1", caption: "New" },
      ]);
    });

    expect(sentBody).toEqual({
      updates: [{ photo_id: "photo-1", caption: "New" }],
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["items", "ws-A"] });
  });

  it("reorder PUTs the full ordered id list and surfaces a toast on error", async () => {
    const { wrapper } = makeHarness();
    let sentBody: unknown;
    server.use(
      http.put(
        "/api/workspaces/:wsId/items/:itemId/photos/order",
        async ({ request }) => {
          sentBody = await request.json();
          return HttpResponse.json({ message: "boom" }, { status: 400 });
        },
      ),
    );

    const { result } = renderHook(() => usePhotoMutations("ws-A", "it-1"), {
      wrapper,
    });
    await act(async () => {
      await result.current.reorder
        .mutateAsync(["photo-2", "photo-1"])
        .catch(() => undefined);
    });

    expect(sentBody).toEqual({ photo_ids: ["photo-2", "photo-1"] });
    expect(retroToast.error).toHaveBeenCalledTimes(1);
  });
});
