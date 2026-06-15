import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";
import type { Photo } from "@/lib/types";
import { photosApi } from "@/lib/api/photos";
import { PhotoGallery } from "./PhotoGallery";

// Phase 7 Plan 04 Task 2 — PhotoGallery: /api-relative thumbnails, set-primary,
// delete-confirm, ◂/▸ reorder (full id list, optimistic), bulk select/delete,
// zip download.

const WS = "ws-1";
const IT = "it-1";

function photo(id: string, overrides: Partial<Photo> = {}): Photo {
  return {
    id,
    item_id: IT,
    workspace_id: WS,
    filename: `${id}.jpg`,
    file_size: 1000,
    mime_type: "image/jpeg",
    width: 800,
    height: 600,
    display_order: 0,
    is_primary: false,
    caption: id,
    url: `/api/workspaces/${WS}/items/${IT}/photos/${id}`,
    thumbnail_url: `/api/workspaces/${WS}/items/${IT}/photos/${id}/thumbnail`,
    thumbnail_status: "ready",
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
    ...overrides,
  };
}

const PHOTOS: Photo[] = [
  photo("p-1", { is_primary: true, display_order: 0 }),
  photo("p-2", { display_order: 1 }),
  photo("p-3", { display_order: 2 }),
];

function renderGallery(onOpen = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <PhotoGallery
            wsId={WS}
            itemId={IT}
            photos={PHOTOS}
            onOpenLightbox={onOpen}
          />
          <RetroToaster />
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
  return onOpen;
}

afterEach(() => vi.restoreAllMocks());

describe("PhotoGallery", () => {
  it("renders thumbnails using /api-relative URLs", () => {
    renderGallery();
    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(3);
    for (const img of imgs) {
      expect(img.getAttribute("src")).toMatch(/^\/api\//);
    }
  });

  it("marks the primary photo and exposes SET PRIMARY on the others", async () => {
    let primaryCalled: string | null = null;
    server.use(
      http.put(`/api/workspaces/${WS}/photos/:id/primary`, ({ params }) => {
        primaryCalled = params.id as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderGallery();
    expect(screen.getByText("★ PRIMARY")).toBeInTheDocument();
    const setButtons = screen.getAllByRole("button", { name: /set primary/i });
    expect(setButtons).toHaveLength(2);
    await userEvent.click(setButtons[0]);
    await waitFor(() => expect(primaryCalled).toBe("p-2"));
  });

  it("DELETE opens the pink confirm then calls del", async () => {
    let deleted: string | null = null;
    server.use(
      http.delete(`/api/workspaces/${WS}/photos/:id`, ({ params }) => {
        deleted = params.id as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderGallery();
    await userEvent.click(
      screen.getByRole("button", { name: /delete p-2\.jpg/i }),
    );
    await waitFor(() =>
      expect(screen.getByText("DELETE PHOTO?")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: "DELETE" }));
    await waitFor(() => expect(deleted).toBe("p-2"));
  });

  it("▸ reorder PUTs the full reordered photo_ids", async () => {
    let sentIds: string[] | null = null;
    server.use(
      http.put(
        `/api/workspaces/${WS}/items/${IT}/photos/order`,
        async ({ request }) => {
          const body = (await request.json()) as { photo_ids: string[] };
          sentIds = body.photo_ids;
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    renderGallery();
    // Move p-1 later (swap with p-2).
    await userEvent.click(
      screen.getByRole("button", { name: /move p-1 later/i }),
    );
    await waitFor(() => expect(sentIds).not.toBeNull());
    expect(sentIds).toEqual(["p-2", "p-1", "p-3"]);
  });

  it("bulk select + DELETE bulk-deletes the selection", async () => {
    let bulkBody: { photo_ids: string[] } | null = null;
    server.use(
      http.post(
        `/api/workspaces/${WS}/items/${IT}/photos/bulk-delete`,
        async ({ request }) => {
          bulkBody = (await request.json()) as { photo_ids: string[] };
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    renderGallery();
    await userEvent.click(screen.getByRole("button", { name: "SELECT" }));
    await userEvent.click(screen.getByRole("button", { name: /toggle p-1/i }));
    await userEvent.click(screen.getByRole("button", { name: /toggle p-3/i }));

    const bar = screen.getByTestId("bulk-action-bar");
    await userEvent.click(within(bar).getByRole("button", { name: "DELETE" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("DELETE PHOTOS?")).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "DELETE" }),
    );
    await waitFor(() => expect(bulkBody).not.toBeNull());
    expect(bulkBody!.photo_ids.sort()).toEqual(["p-1", "p-3"]);
  });

  it("DOWNLOAD ALL triggers the zip endpoint", async () => {
    const spy = vi.spyOn(photosApi, "downloadZip").mockResolvedValue(undefined);
    renderGallery();
    await userEvent.click(
      screen.getByRole("button", { name: /download all/i }),
    );
    expect(spy).toHaveBeenCalledWith(WS, IT, undefined);
  });

  it("opens the lightbox at the clicked index when not selecting", async () => {
    const onOpen = renderGallery();
    await userEvent.click(screen.getByRole("button", { name: /open p-3/i }));
    expect(onOpen).toHaveBeenCalledWith(2);
  });
});
