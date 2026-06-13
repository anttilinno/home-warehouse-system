import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { useItemAttachments } from "./useItemAttachments";

// Phase 14b Plan 03 Task 2 (TDD) — item attachment reads + REAL multipart upload +
// set-primary + delete. The list query is keyed ["items", wsId, itemId,
// "attachments"] (LOCKED — 14b-04 invalidates the same tuple). All THREE mutations
// invalidate that key (ATT-02 contract).

const WS = "ws-1";
const ITEM = "item-1";
const ATT_KEY = ["items", WS, ITEM, "attachments"];

const ATTACHMENT = {
  id: "att-1",
  item_id: ITEM,
  file_id: "file-1",
  attachment_type: "RECEIPT" as const,
  title: "Parts receipt",
  is_primary: false,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
  file_name: "receipt.pdf",
  file_mime_type: "application/pdf",
  file_size_bytes: 20480,
};

function listHandler() {
  return http.get("/api/workspaces/:wsId/items/:itemId/attachments", () =>
    HttpResponse.json({ items: [ATTACHMENT] }),
  );
}

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

afterEach(() => vi.clearAllMocks());

describe("useItemAttachments", () => {
  it("lists attachments keyed [items,wsId,itemId,attachments]", async () => {
    server.use(listHandler());
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => useItemAttachments(WS, ITEM), {
      wrapper,
    });
    await waitFor(() => expect(result.current.items.length).toBe(1));
    expect(result.current.items[0].file_name).toBe("receipt.pdf");
  });

  it("upload posts multipart and invalidates the attachments key", async () => {
    server.use(listHandler());
    let received: { field: string; filename: string } | null = null;
    server.use(
      http.post(
        "/api/workspaces/:wsId/items/:itemId/attachments/file",
        async ({ request }) => {
          const form = await request.formData();
          const file = form.get("file");
          received = {
            field: String(form.get("attachment_type")),
            filename: file instanceof File ? file.name : "",
          };
          return HttpResponse.json({ ...ATTACHMENT, id: "att-new" });
        },
      ),
    );
    const { client, wrapper } = makeHarness();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useItemAttachments(WS, ITEM), {
      wrapper,
    });

    await act(async () => {
      const form = new FormData();
      form.append(
        "file",
        new File(["bytes"], "manual.pdf", { type: "application/pdf" }),
      );
      form.append("attachment_type", "MANUAL");
      await result.current.upload.mutateAsync(form);
    });

    expect(received).toEqual({ field: "MANUAL", filename: "manual.pdf" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ATT_KEY });
  });

  it("setPrimary invalidates the attachments key", async () => {
    server.use(listHandler());
    let primaryId = "";
    server.use(
      http.post(
        "/api/workspaces/:wsId/items/:itemId/attachments/:attId/set-primary",
        ({ params }) => {
          primaryId = String(params.attId);
          return new HttpResponse(null, { status: 200 });
        },
      ),
    );
    const { client, wrapper } = makeHarness();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useItemAttachments(WS, ITEM), {
      wrapper,
    });

    await act(async () => {
      await result.current.setPrimary.mutateAsync("att-1");
    });

    expect(primaryId).toBe("att-1");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ATT_KEY });
  });

  it("delete removes a row and invalidates the attachments key", async () => {
    server.use(listHandler());
    let deleted = "";
    server.use(
      http.delete("/api/workspaces/:wsId/attachments/:attId", ({ params }) => {
        deleted = String(params.attId);
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const { client, wrapper } = makeHarness();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useItemAttachments(WS, ITEM), {
      wrapper,
    });

    await act(async () => {
      await result.current.deleteAttachment.mutateAsync("att-1");
    });

    expect(deleted).toBe("att-1");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ATT_KEY });
  });
});
